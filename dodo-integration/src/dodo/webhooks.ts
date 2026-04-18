import crypto from 'node:crypto'
import type { Request, Response } from 'express'
import type { Pool } from 'pg'
import type {
  DodoWebhookEvent,
  DodoWebhookEventType,
  DodoPaymentEventData,
  DodoSubscriptionEventData,
} from './types.js'

// ── Signature verification ─────────────────────────────────────────────────────

const TIMESTAMP_TOLERANCE_SECONDS = 300

/**
 * Verify a Dodo webhook using the Standard Webhooks spec (HMAC-SHA256).
 * Requires the raw request body — use express.raw({ type: 'application/json' }).
 * Throws on missing headers, stale timestamp, or bad signature.
 */
export function verifyDodoWebhook(
  rawBody: Buffer | string,
  headers: {
    'webhook-id': string
    'webhook-timestamp': string
    'webhook-signature': string
  },
): DodoWebhookEvent {
  const secret = process.env.DODO_WEBHOOK_SECRET
  if (!secret) throw new Error('DODO_WEBHOOK_SECRET env var is not set')

  const { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': sigHeader } = headers
  if (!id || !timestamp || !sigHeader) throw new Error('Missing Standard Webhooks headers')

  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    throw new Error('Webhook timestamp is outside the tolerance window')
  }

  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
  const signedContent = `${id}.${timestamp}.${body}`

  const secretBytes = Buffer.from(secret, 'base64')
  const computed = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64')

  // Header may be space-separated "v1,{sig}" pairs (supports key rotation)
  const signatures = sigHeader
    .split(' ')
    .map((s) => s.split(',').slice(1).join(','))
    .filter(Boolean)

  const valid = signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig))
    } catch {
      return false
    }
  })
  if (!valid) throw new Error('Webhook signature verification failed')

  return JSON.parse(body) as DodoWebhookEvent
}

// ── Idempotency ────────────────────────────────────────────────────────────────

/**
 * Returns true if this webhook-id was already processed (duplicate delivery).
 * Inserts the id atomically so concurrent deliveries of the same event are safe.
 *
 * Requires table:
 *   CREATE TABLE dodo_webhook_events (
 *     event_id   TEXT PRIMARY KEY,
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 */
async function isAlreadyProcessed(db: Pool, eventId: string): Promise<boolean> {
  const result = await db.query(
    `INSERT INTO dodo_webhook_events (event_id)
     VALUES ($1)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId],
  )
  // If no row was returned, the INSERT was a no-op → duplicate
  return result.rowCount === 0
}

// ── Business logic handlers ────────────────────────────────────────────────────

async function onSubscriptionActive(db: Pool, data: DodoSubscriptionEventData): Promise<void> {
  // Fires once when the subscription is created + first payment succeeds.
  // Provision the plan: store subscription/customer IDs, activate plan, send welcome email.
  console.log('[dodo] subscription.active', data.subscription_id)

  await db.query(
    `UPDATE users
     SET plan = 'pro',
         dodo_subscription_id = $1,
         dodo_customer_id     = $2,
         credits_used         = 0,
         credits_reset_at     = NOW()
     WHERE id = $3`,
    [data.subscription_id, data.customer_id, data.metadata?.user_id],
  )
  // TODO: send welcome / payment confirmation email
}

async function onSubscriptionRenewed(db: Pool, data: DodoSubscriptionEventData): Promise<void> {
  // Fires every billing period on successful renewal.
  // Reset monthly credits/quotas here — this is the renewal confirmation.
  console.log('[dodo] subscription.renewed', data.subscription_id)

  await db.query(
    `UPDATE users
     SET credits_used     = 0,
         credits_reset_at = NOW()
     WHERE dodo_subscription_id = $1`,
    [data.subscription_id],
  )
  // TODO: send monthly receipt email
}

async function onSubscriptionOnHold(db: Pool, data: DodoSubscriptionEventData): Promise<void> {
  // Fires when a renewal payment fails and Dodo pauses the subscription.
  // Restrict access now — don't wait for subscription.cancelled (comes much later).
  console.log('[dodo] subscription.on_hold', data.subscription_id)

  await db.query(
    `UPDATE users SET plan = 'on_hold' WHERE dodo_subscription_id = $1`,
    [data.subscription_id],
  )
  // TODO: send "payment failed — please update your card" email
}

async function onSubscriptionCancelled(db: Pool, data: DodoSubscriptionEventData): Promise<void> {
  // Fires after all dunning retries fail, or when the customer explicitly cancels.
  console.log('[dodo] subscription.cancelled', data.subscription_id)

  await db.query(
    `UPDATE users
     SET plan                 = 'free',
         dodo_subscription_id = NULL
     WHERE dodo_subscription_id = $1`,
    [data.subscription_id],
  )
  // TODO: send cancellation confirmation email
}

async function onSubscriptionPlanChanged(db: Pool, data: DodoSubscriptionEventData): Promise<void> {
  // Fires after a successful upgrade or downgrade via changePlan().
  // Sync the new plan tier into your DB.
  console.log('[dodo] subscription.plan_changed', data.subscription_id, data.product_id)

  const planName = productIdToPlan(data.product_id)
  if (planName) {
    await db.query(
      `UPDATE users SET plan = $1 WHERE dodo_subscription_id = $2`,
      [planName, data.subscription_id],
    )
  }
}

async function onPaymentFailed(db: Pool, data: DodoPaymentEventData): Promise<void> {
  // Fires on every failed charge attempt (Dodo retries before pausing).
  // Log it; dunning logic lives in onSubscriptionOnHold.
  console.log('[dodo] payment.failed', { paymentId: data.payment_id, subId: data.subscription_id })

  // TODO: send "payment failed, we'll retry" email on first failure
}

async function onRefundSucceeded(db: Pool, data: DodoPaymentEventData): Promise<void> {
  // Fires when Dodo processes a refund.
  console.log('[dodo] refund.succeeded', { paymentId: data.payment_id, amount: data.amount })

  // TODO: record refund in billing_events table, revoke access if full refund
}

// ── Plan mapping ───────────────────────────────────────────────────────────────

/** Map Dodo product_id → your internal plan name. Add all your plan IDs here. */
function productIdToPlan(productId: string): string | null {
  const map: Record<string, string> = {
    [process.env.DODO_PRODUCT_STARTER ?? '']: 'starter',
    [process.env.DODO_PRODUCT_PRO     ?? '']: 'pro',
    [process.env.DODO_PRODUCT_ENTERPRISE ?? '']: 'enterprise',
  }
  return map[productId] ?? null
}

// ── Express route handler ──────────────────────────────────────────────────────

/**
 * Factory: call with your pg Pool so handlers can query your DB.
 *
 *   import { Pool } from 'pg'
 *   const db = new Pool({ connectionString: process.env.DATABASE_URL })
 *
 *   app.post(
 *     '/webhooks/dodo',
 *     express.raw({ type: 'application/json' }),
 *     createDodoWebhookHandler(db),
 *   )
 */
export function createDodoWebhookHandler(db: Pool) {
  return async function dodoWebhookHandler(req: Request, res: Response): Promise<void> {
    // 1. Verify signature
    let event: DodoWebhookEvent
    try {
      event = verifyDodoWebhook(req.body as Buffer, {
        'webhook-id': req.headers['webhook-id'] as string,
        'webhook-timestamp': req.headers['webhook-timestamp'] as string,
        'webhook-signature': req.headers['webhook-signature'] as string,
      })
    } catch (err) {
      console.error('[dodo] Webhook verification failed:', (err as Error).message)
      res.status(400).json({ error: 'Invalid webhook' })
      return
    }

    const webhookId = req.headers['webhook-id'] as string
    const type = event.type as DodoWebhookEventType

    // 2. Idempotency check — skip if already processed (Dodo retries on non-200)
    if (await isAlreadyProcessed(db, webhookId)) {
      console.log(`[dodo] Duplicate event skipped: ${webhookId} (${type})`)
      res.status(200).json({ received: true })
      return
    }

    // 3. Dispatch to handler
    try {
      switch (type) {
        case 'subscription.active':
          await onSubscriptionActive(db, event.data as DodoSubscriptionEventData)
          break
        case 'subscription.renewed':
          await onSubscriptionRenewed(db, event.data as DodoSubscriptionEventData)
          break
        case 'subscription.on_hold':
          await onSubscriptionOnHold(db, event.data as DodoSubscriptionEventData)
          break
        case 'subscription.cancelled':
          await onSubscriptionCancelled(db, event.data as DodoSubscriptionEventData)
          break
        case 'subscription.plan_changed':
          await onSubscriptionPlanChanged(db, event.data as DodoSubscriptionEventData)
          break
        case 'payment.failed':
          await onPaymentFailed(db, event.data as DodoPaymentEventData)
          break
        case 'refund.succeeded':
          await onRefundSucceeded(db, event.data as DodoPaymentEventData)
          break
        default:
          console.log(`[dodo] Unhandled event type: ${type}`)
      }
    } catch (err) {
      console.error(`[dodo] Error handling ${type}:`, err)
      // Return 500 so Dodo retries — idempotency table entry is already inserted,
      // so delete it to allow the retry to re-process.
      await db.query('DELETE FROM dodo_webhook_events WHERE event_id = $1', [webhookId]).catch(() => {})
      res.status(500).json({ error: 'Handler error' })
      return
    }

    res.status(200).json({ received: true })
  }
}
