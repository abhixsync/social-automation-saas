import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRazorpay } from '@/lib/razorpay'
import { PLAN_CONFIG } from '@/types'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    await getRazorpay().subscriptions.cancel(user.razorpaySubscriptionId, false)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: 'free',
        razorpaySubscriptionId: null,
        aiCreditsTotal: PLAN_CONFIG.free.creditsPerMonth,
        aiCreditsUsed: 0,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[billing/cancel]', err)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
