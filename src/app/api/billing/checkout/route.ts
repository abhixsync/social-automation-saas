import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createCheckoutSession } from '@/lib/dodo/checkout'
import { DodoApiError } from '@/lib/dodo/client'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'

const schema = z.object({
  plan: z.enum(['pro']),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { allowed } = await checkRateLimit(`billing-checkout:${session.user.id}`, 5, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { plan } = schema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        plan: true,
        dodoCustomerId: true,
        dodoSubscriptionId: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (user.plan !== 'free' || user.dodoSubscriptionId) {
      return NextResponse.json({ error: 'You already have an active subscription' }, { status: 409 })
    }

    const productId = process.env.DODO_PRODUCT_PRO
    if (!productId) {
      return NextResponse.json({ error: 'Pro plan not configured' }, { status: 500 })
    }

    const countryCode = user.currency === 'INR' ? 'IN' : 'US'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    const checkoutSession = await createCheckoutSession({
      productId,
      email: user.email ?? '',
      name: user.name ?? undefined,
      customerId: user.dodoCustomerId ?? undefined,
      countryCode,
      returnUrl: `${appUrl}/dashboard/billing?success=1`,
      cancelUrl: `${appUrl}/dashboard/billing`,
      metadata: { user_id: user.id, plan },
    })

    return NextResponse.json({ checkoutUrl: checkoutSession.checkout_url })
  } catch (err) {
    if (err instanceof DodoApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
