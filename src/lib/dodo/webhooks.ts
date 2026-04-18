import crypto from 'node:crypto'

const TIMESTAMP_TOLERANCE_SECONDS = 300

export type DodoWebhookEventType =
  | 'subscription.active'
  | 'subscription.renewed'
  | 'subscription.on_hold'
  | 'subscription.cancelled'
  | 'subscription.plan_changed'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'refund.succeeded'

export interface DodoSubscriptionEventData {
  subscription_id: string
  customer_id: string
  product_id: string
  status: string
  metadata?: Record<string, string>
  customer?: {
    customer_id?: string
    email?: string
    name?: string
  }
}

export interface DodoPaymentEventData {
  payment_id: string
  subscription_id?: string
  customer_id?: string
  amount: number
  currency: string
  product_id?: string
  metadata?: Record<string, string>
}

export interface DodoWebhookEvent {
  type: DodoWebhookEventType
  data: DodoSubscriptionEventData | DodoPaymentEventData
}

/**
 * Verify a Dodo webhook using the Standard Webhooks spec (HMAC-SHA256).
 * Pass the raw request body string — do NOT parse it first.
 * Throws on missing headers, stale timestamp, or bad signature.
 */
export function verifyDodoWebhook(
  rawBody: string,
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

  const signedContent = `${id}.${timestamp}.${rawBody}`
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

  return JSON.parse(rawBody) as DodoWebhookEvent
}
