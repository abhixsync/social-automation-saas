import { NextRequest, NextResponse } from 'next/server'
import { stripe, buildPriceMap, getCreditsForPlan } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { addTopupCredits, resetMonthlyCredits } from '@/lib/credits'
import type Stripe from 'stripe'
import type { Plan, Currency } from '@/generated/prisma/enums'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const priceMap = buildPriceMap()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        if (!userId) break

        if (session.mode === 'payment') {
          // Top-up credits purchase — atomic to prevent duplicate credits on webhook retry
          const credits = parseInt(session.metadata?.credits ?? '0', 10)
          if (credits > 0) {
            const amount = session.amount_total ?? 0
            const currency = (session.currency?.toUpperCase() ?? 'INR') as Currency
            try {
              await prisma.$transaction([
                prisma.user.update({
                  where: { id: userId },
                  data: { aiCreditsTotal: { increment: credits } },
                }),
                prisma.creditTopup.create({
                  data: {
                    userId,
                    credits,
                    amount,
                    currency,
                    stripePaymentIntentId: session.payment_intent as string,
                  },
                }),
              ])
            } catch (txErr: unknown) {
              // P2002 = unique constraint on stripePaymentIntentId — already processed
              if ((txErr as { code?: string }).code === 'P2002') break
              throw txErr
            }
          }
        }
        // Subscription mode handled by customer.subscription.created below
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price?.id
        const planInfo = priceMap.get(priceId ?? '')

        // Look up user by Stripe customer ID
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: sub.customer as string },
          select: { id: true, aiCreditsTotal: true },
        })
        if (!user || !planInfo) break

        const newCredits = getCreditsForPlan(planInfo.plan as Plan)
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: planInfo.plan as Plan,
            stripeSubscriptionId: sub.id,
          },
        })
        await resetMonthlyCredits(user.id, newCredits)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: sub.customer as string },
          select: { id: true },
        })
        if (!user) break

        await prisma.user.update({
          where: { id: user.id },
          data: { plan: 'free', stripeSubscriptionId: null },
        })
        await resetMonthlyCredits(user.id, 40) // free plan credits
        break
      }
    }
  } catch (err) {
    console.error(`[webhook] Error handling ${event.type}:`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
