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

  let event: ReturnType<typeof verifyDodoWebhook>
  try {
    event = verifyDodoWebhook(rawBody, {
      'webhook-id': req.headers.get('webhook-id') ?? '',
      'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': req.headers.get('webhook-signature') ?? '',
    })
  } catch (err) {
    console.error('[dodo/webhook] Verification failed:', (err as Error).message)
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
  }

  const webhookId = req.headers.get('webhook-id') ?? ''
  const type = event.type as DodoWebhookEventType

  // Idempotency: skip if already processed (Dodo retries on non-200)
  const existing = await prisma.webhookEvent.findUnique({ where: { eventId: webhookId } })
  if (existing) {
    return NextResponse.json({ received: true })
  }

  try {
    switch (type) {
      case 'subscription.active': {
        const data = event.data as DodoSubscriptionEventData
        const userId = data.metadata?.user_id
        if (!userId) break

        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: 'pro',
            dodoSubscriptionId: data.subscription_id,
            dodoCustomerId: data.customer_id,
          },
        })
        await resetMonthlyCredits(userId, 'pro')
        break
      }

      case 'subscription.renewed': {
        const data = event.data as DodoSubscriptionEventData
        const user = await prisma.user.findFirst({
          where: { dodoSubscriptionId: data.subscription_id },
          select: { id: true },
        })
        if (!user) break

        await resetMonthlyCredits(user.id, 'pro')
        break
      }

      case 'subscription.on_hold': {
        const data = event.data as DodoSubscriptionEventData
        await prisma.user.updateMany({
          where: { dodoSubscriptionId: data.subscription_id },
          data: { plan: 'on_hold' },
        })
        break
      }

      case 'subscription.cancelled': {
        const data = event.data as DodoSubscriptionEventData
        await prisma.user.updateMany({
          where: { dodoSubscriptionId: data.subscription_id },
          data: { plan: 'free', dodoSubscriptionId: null },
        })
        break
      }

      case 'subscription.plan_changed': {
        const data = event.data as DodoSubscriptionEventData
        const plan = productIdToPlan(data.product_id)
        if (plan) {
          await prisma.user.updateMany({
            where: { dodoSubscriptionId: data.subscription_id },
            data: { plan },
          })
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
    // Return 500 so Dodo retries — don't mark as processed
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  // Mark as processed only after successful handling
  await prisma.webhookEvent.create({ data: { eventId: webhookId } }).catch(() => {})

  return NextResponse.json({ received: true })
}
