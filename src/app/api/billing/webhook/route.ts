import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/razorpay'
import { resetMonthlyCredits } from '@/lib/credits'
import type { Currency } from '@/generated/prisma/enums'

function getPlanFromPlanId(planId: string): 'pro' | null {
  const currencies: Currency[] = ['INR', 'USD']
  for (const currency of currencies) {
    if (process.env[`RAZORPAY_PRO_PLAN_${currency}`] === planId) return 'pro'
  }
  return null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 })
  }

  const isValid = verifyWebhookSignature(rawBody, signature)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    switch (event.event) {
      case 'subscription.activated': {
        const sub = event.payload.subscription.entity
        const subscriptionId: string = sub.id
        const planId: string = sub.plan_id

        const plan = getPlanFromPlanId(planId)
        if (!plan) break

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { razorpaySubscriptionId: subscriptionId },
              { razorpayCustomerId: sub.customer_id },
            ],
          },
          select: { id: true },
        })
        if (!user) break

        await prisma.user.update({
          where: { id: user.id },
          data: { plan, razorpaySubscriptionId: subscriptionId },
        })
        await resetMonthlyCredits(user.id, plan)
        break
      }

      case 'subscription.charged': {
        const sub = event.payload.subscription.entity
        const subscriptionId: string = sub.id
        const planId: string = sub.plan_id

        const plan = getPlanFromPlanId(planId)
        if (!plan) break

        const user = await prisma.user.findFirst({
          where: { razorpaySubscriptionId: subscriptionId },
          select: { id: true },
        })
        if (!user) break

        await resetMonthlyCredits(user.id, plan)
        break
      }

      case 'subscription.cancelled':
      case 'subscription.completed': {
        const sub = event.payload.subscription.entity
        const subscriptionId: string = sub.id

        const user = await prisma.user.findFirst({
          where: { razorpaySubscriptionId: subscriptionId },
          select: { id: true },
        })
        if (!user) break

        await prisma.user.update({
          where: { id: user.id },
          data: { plan: 'free', razorpaySubscriptionId: null },
        })
        await resetMonthlyCredits(user.id, 'free')
        break
      }

      case 'payment.captured': {
        // Top-up payments are handled by the /api/billing/verify endpoint
        break
      }
    }
  } catch (err) {
    console.error(`[webhook] Error handling ${event?.event}:`, err)
    // Return 200 anyway — Razorpay retries on non-200
  }

  return NextResponse.json({ received: true })
}
