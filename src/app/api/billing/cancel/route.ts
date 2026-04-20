import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cancelSubscription } from '@/lib/dodo/subscriptions'
import { DodoApiError } from '@/lib/dodo/client'
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
      select: { id: true, dodoSubscriptionId: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (!user.dodoSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    // Cancel immediately — Dodo fires subscription.cancelled webhook which downgrades the plan
    await cancelSubscription(user.dodoSubscriptionId, { immediately: true })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof DodoApiError) {
      console.error('[billing/cancel] Dodo error:', err.message, err.status)
      return NextResponse.json({ error: 'Payment service error. Please try again.' }, { status: 502 })
    }
    console.error('[billing/cancel]', err)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
