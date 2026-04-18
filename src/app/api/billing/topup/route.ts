import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createCheckoutSession } from '@/lib/dodo/checkout'
import { DodoApiError } from '@/lib/dodo/client'
import { checkRateLimit } from '@/lib/ratelimit'
import { TOPUP_CREDITS } from '@/types'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { allowed } = await checkRateLimit(`billing-topup:${session.user.id}`, 5, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, currency: true, dodoCustomerId: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const productId = process.env.DODO_PRODUCT_TOPUP
    if (!productId) {
      return NextResponse.json({ error: 'Topup product not configured' }, { status: 500 })
    }

    const countryCode = user.currency === 'INR' ? 'IN' : 'US'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    const checkoutSession = await createCheckoutSession({
      productId,
      email: user.email ?? '',
      name: user.name ?? undefined,
      customerId: user.dodoCustomerId ?? undefined,
      countryCode,
      returnUrl: `${appUrl}/dashboard/billing?topup=1`,
      cancelUrl: `${appUrl}/dashboard/billing`,
      // Metadata echoed back in payment.succeeded webhook so we know who to credit
      metadata: { user_id: user.id, credits: String(TOPUP_CREDITS) },
    })

    return NextResponse.json({ checkoutUrl: checkoutSession.checkout_url })
  } catch (err) {
    if (err instanceof DodoApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[billing/topup]', err)
    return NextResponse.json({ error: 'Failed to create topup checkout' }, { status: 500 })
  }
}
