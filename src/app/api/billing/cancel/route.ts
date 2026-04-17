import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRazorpay } from '@/lib/razorpay'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { allowed } = await checkRateLimit(`billing-cancel:${session.user.id}`, 3, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, razorpaySubscriptionId: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (!user.razorpaySubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    // Cancel at period end — Razorpay fires subscription.cancelled webhook
    // when the billing period expires, which handles the actual downgrade.
    await getRazorpay().subscriptions.cancel(user.razorpaySubscriptionId, false)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[billing/cancel]', err)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
