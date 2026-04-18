import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSubscription } from '@/lib/dodo/subscriptions'
import { resetMonthlyCredits } from '@/lib/credits'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  const { searchParams } = new URL(req.url)
  const subscriptionId = searchParams.get('subscription_id')
  const status = searchParams.get('status')

  // If no subscription_id or status isn't active, just redirect to billing
  if (!subscriptionId || status !== 'active') {
    return NextResponse.redirect(new URL('/dashboard/billing?success=1', req.url))
  }

  try {
    // Verify subscription is actually active via Dodo API
    const subscription = await getSubscription(subscriptionId)

    if (subscription.status === 'active') {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          plan: 'pro',
          dodoSubscriptionId: subscription.subscription_id,
          dodoCustomerId: subscription.customer_id,
        },
      })
      await resetMonthlyCredits(session.user.id, 'pro')
    }
  } catch (err) {
    console.error('[billing/success] Failed to verify subscription:', err)
    // Still redirect to billing — webhook may handle it
  }

  return NextResponse.redirect(new URL('/dashboard/billing?success=1', req.url))
}
