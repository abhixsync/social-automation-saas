// ── Checkout ──────────────────────────────────────────────────────────────────

export interface DodoCheckoutSession {
  session_id: string
  checkout_url: string | null
}

export interface CreateCheckoutOptions {
  /** Dodo product_id for the plan (create in Dashboard → Products) */
  productId: string
  quantity?: number
  customer: {
    email: string
    name: string
    /** Pass to skip creating a new customer record on repeat purchases */
    customerId?: string
  }
  returnUrl: string
  cancelUrl: string
  /** ISO 3166-1 alpha-2. Drives currency (IN → INR, else USD) and billing address */
  countryCode: string
  /** GST number for Indian B2B customers; VAT number for EU; etc. */
  taxId?: string
  trialDays?: number
  metadata?: Record<string, string>
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export type DodoSubscriptionStatus =
  | 'pending'
  | 'active'
  | 'on_hold'
  | 'cancelled'
  | 'failed'
  | 'expired'

export interface DodoSubscription {
  subscription_id: string
  product_id: string
  customer: {
    customer_id: string
    name: string
    email: string
    phone: string | null
    metadata: Record<string, unknown>
  }
  status: DodoSubscriptionStatus
  currency: string
  /** Amount in smallest currency unit (paise for INR, cents for USD) */
  recurring_pre_tax_amount: number
  tax_inclusive: boolean
  billing: {
    country: string
    city?: string
    state?: string
    street?: string
    zipcode?: string
  }
  quantity: number
  trial_period_days: number
  subscription_period_interval: 'Day' | 'Week' | 'Month' | 'Year'
  subscription_period_count: number
  payment_frequency_interval: 'Day' | 'Week' | 'Month' | 'Year'
  payment_frequency_count: number
  created_at: string
  next_billing_date: string | null
  previous_billing_date: string | null
  cancelled_at: string | null
  expires_at: string | null
  cancel_at_next_billing_date: boolean
  on_demand: boolean
  payment_method_id: string | null
  metadata: Record<string, unknown>
}

export interface CancelSubscriptionOptions {
  /**
   * true  = cancel immediately (customer loses access now)
   * false = cancel at next billing date (default — customer keeps access until period end)
   */
  immediately?: boolean
  reason?: 'cancelled_by_customer' | 'cancelled_by_merchant'
}

export interface ChangePlanOptions {
  newProductId: string
  quantity?: number
  /**
   * How to handle proration:
   * - 'prorated_immediately' — charge/credit the difference right now (default)
   * - 'full_immediately'     — charge full new plan price immediately
   * - 'do_not_bill'          — switch plan with no charge
   */
  proration?: 'prorated_immediately' | 'full_immediately' | 'do_not_bill'
  effectiveAt?: 'immediately' | 'next_billing_date'
  onPaymentFailure?: 'prevent_change' | 'apply_change'
  metadata?: Record<string, string>
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export type DodoWebhookEventType =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.processing'
  | 'payment.cancelled'
  | 'subscription.active'      // NOTE: Dodo uses 'subscription.active', not 'subscription.created'
  | 'subscription.updated'
  | 'subscription.on_hold'
  | 'subscription.renewed'
  | 'subscription.plan_changed'
  | 'subscription.cancelled'
  | 'subscription.failed'
  | 'subscription.expired'
  | 'refund.succeeded'
  | 'refund.failed'
  | (string & {})              // forward-compat: allow unknown future event types

export interface DodoPaymentEventData {
  payment_id: string
  subscription_id?: string
  customer_id?: string
  amount: number
  currency: string
  status: string
  metadata?: Record<string, unknown>
}

export interface DodoSubscriptionEventData {
  subscription_id: string
  product_id: string
  customer_id: string
  status: DodoSubscriptionStatus
  currency: string
  metadata?: Record<string, unknown>
}

export interface DodoWebhookEvent<T = Record<string, unknown>> {
  type: DodoWebhookEventType
  data: T
}
