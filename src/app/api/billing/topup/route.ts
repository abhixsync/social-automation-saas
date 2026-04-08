import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, getTopupPriceId, getOrCreateStripeCustomer, TOPUP_CREDITS } from '@/lib/stripe'
import type { Currency } from '@/generated/prisma/enums'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { quantity = 1 } = await req.json().catch(() => ({}))

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, email: true, name: true,
        currency: true, stripeCustomerId: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const customerId = await getOrCreateStripeCustomer(
      user.id, user.email, user.name, user.stripeCustomerId,
    )
    if (!user.stripeCustomerId) {
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } })
    }

    const priceId = getTopupPriceId(user.currency as Currency)

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?topup=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      metadata: {
        userId: user.id,
        type: 'topup',
        credits: String(TOPUP_CREDITS * quantity),
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    console.error('[billing/topup]', err)
    return NextResponse.json({ error: 'Failed to create top-up session' }, { status: 500 })
  }
}
