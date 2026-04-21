import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyDodoWebhook } from '@/lib/dodo/webhooks'
import { resetMonthlyCredits } from '@/lib/credits'
import { addTopupCredits } from '@/lib/credits'
import type {
  DodoSubscriptionEventData,
  DodoPaymentEventData,
  DodoWebhookEventType,
} from '@/lib/dodo/webhooks'

// Map Dodo product_id → internal plan name
function productIdToPlan(productId: string): 'pro' | null {
  const map: Record<string, 'pro'> = {
    [process.env.DODO_PRODUCT_PRO ?? '']: 'pro',
  }
  return map[productId] ?? null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const webhookHeaders = {
    'webhook-id': req.headers.get('webhook-id') ?? '',
    'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
    'webhook-signature': req.headers.get('webhook-signature') ?? '',
  }
  console.log('[dodo/webhook] Received — id:', webhookHeaders['webhook-id'], 'body preview:', rawBody.slice(0, 300))

  let event: ReturnType<typeof verifyDodoWebhook>
  try {
    event = verifyDodoWebhook(rawBody, webhookHeaders)
  } catch (err) {
    console.error('[dodo/webhook] Verification failed:', (err as Error).message, '| secret set:', !!process.env.DODO_WEBHOOK_SECRET)
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
  }

  console.log('[dodo/webhook] Verified — type:', event.type, 'data:', JSON.stringify(event.data).slice(0, 300))

  const webhookId = webhookHeaders['webhook-id']
  const type = event.type as DodoWebhookEventType

  // Idempotency: optimistic insert — if the event was already processed, the unique
  // constraint fires immediately before any business logic runs, eliminating the
  // check-then-act race that a find-then-create pattern has under concurrent retries.
  try {
    await prisma.webhookEvent.create({ data: { eventId: webhookId } })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ received: true })
    }
    throw e
  }

  try {
    switch (type) {
      case 'subscription.active': {
        const data = event.data as DodoSubscriptionEventData
        // Try metadata first; fall back to customer email lookup
        let userId = data.metadata?.user_id
        if (!userId) {
          const email = data.customer?.email
          if (!email) {
            console.error('[dodo/webhook] subscription.active: no user_id in metadata and no customer email')
            break
          }
          const found = await prisma.user.findFirst({ where: { email }, select: { id: true } })
          if (!found) {
            console.error('[dodo/webhook] subscription.active: no user found for email', email)
            break
          }
          userId = found.id
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            plan: 'pro',
            dodoSubscriptionId: data.subscription_id,
            dodoCustomerId: data.customer_id,
          },
          select: { creditsResetAt: true },
        })

        // Idempotent: skip if credits were reset within the last 2 hours
        const resetRecentlyActive = updatedUser.creditsResetAt &&
          (Date.now() - updatedUser.creditsResetAt.getTime()) < 2 * 60 * 60 * 1000
        if (!resetRecentlyActive) {
          await resetMonthlyCredits(userId, 'pro')
        }
        break
      }

      case 'subscription.renewed': {
        const data = event.data as DodoSubscriptionEventData
        const user = await prisma.user.findFirst({
          where: { dodoSubscriptionId: data.subscription_id },
          select: { id: true, creditsResetAt: true },
        })
        if (!user) break

        // Idempotent: skip if credits were reset within the last 23 hours
        const resetRecently = user.creditsResetAt &&
          (Date.now() - user.creditsResetAt.getTime()) < 23 * 60 * 60 * 1000
        if (!resetRecently) {
          await resetMonthlyCredits(user.id, 'pro')
        }
        break
      }

      case 'subscription.on_hold': {
        const data = event.data as DodoSubscriptionEventData
        const onHoldUser = await prisma.user.findFirst({
          where: { dodoSubscriptionId: data.subscription_id },
          select: { id: true },
        })
        if (!onHoldUser) break
        await prisma.user.update({
          where: { id: onHoldUser.id },
          data: { plan: 'on_hold' },
        })
        await prisma.notification.create({
          data: {
            userId: onHoldUser.id,
            message: 'Your payment failed. Please update your payment method to continue using pro features.',
          },
        })
        break
      }

      case 'subscription.cancelled': {
        const data = event.data as DodoSubscriptionEventData
        const cancelledUser = await prisma.user.findFirst({
          where: { dodoSubscriptionId: data.subscription_id },
          select: { id: true },
        })
        if (!cancelledUser) break
        await prisma.user.update({
          where: { id: cancelledUser.id },
          data: { plan: 'free', dodoSubscriptionId: null },
        })
        // Reset credits to free-tier allocation — prevents cancelled users retaining pro credits
        await resetMonthlyCredits(cancelledUser.id, 'free')
        break
      }

      case 'subscription.plan_changed': {
        const data = event.data as DodoSubscriptionEventData
        const plan = productIdToPlan(data.product_id)
        if (plan) {
          const user = await prisma.user.findFirst({
            where: { dodoSubscriptionId: data.subscription_id },
            select: { id: true },
          })
          if (user) {
            await prisma.user.update({ where: { id: user.id }, data: { plan } })
            await resetMonthlyCredits(user.id, plan)
          }
        }
        break
      }

      case 'payment.succeeded': {
        // One-time topup purchase
        const data = event.data as DodoPaymentEventData
        const userId = data.metadata?.user_id
        const creditsStr = data.metadata?.credits
        if (!userId || !creditsStr) break

        const credits = parseInt(creditsStr, 10)
        if (isNaN(credits) || credits <= 0) break

        await addTopupCredits(userId, credits)
        await prisma.creditTopup.create({
          data: {
            userId,
            credits,
            amount: data.amount,
            currency: data.currency === 'INR' ? 'INR' : 'USD',
            dodoPaymentId: data.payment_id,
          },
        })
        await prisma.notification.create({
          data: {
            userId,
            message: `${credits} credits added to your account.`,
          },
        })
        break
      }

      case 'payment.failed': {
        const data = event.data as DodoPaymentEventData
        console.log('[dodo] payment.failed', { paymentId: data.payment_id })
        break
      }

      case 'refund.succeeded': {
        const data = event.data as DodoPaymentEventData
        console.log('[dodo] refund.succeeded', { paymentId: data.payment_id, amount: data.amount })
        break
      }

      default:
        console.log(`[dodo/webhook] Unhandled event type: ${type}`)
    }
  } catch (err) {
    console.error(`[dodo/webhook] Error handling ${type}:`, err)
    // Delete the idempotency record so Dodo can retry this event
    await prisma.webhookEvent.delete({ where: { eventId: webhookId } }).catch(() => {})
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
