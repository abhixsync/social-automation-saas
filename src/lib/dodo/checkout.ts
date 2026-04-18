import { dodoFetch } from './client'

export interface DodoCheckoutSession {
  session_id: string
  checkout_url: string
}

interface CheckoutOptions {
  productId: string
  email: string
  name?: string
  customerId?: string
  countryCode?: string
  metadata?: Record<string, string>
  returnUrl: string
  cancelUrl?: string
  trialDays?: number
}

/**
 * Create a hosted Dodo checkout session.
 * Returns checkout_url — redirect the customer there to complete payment.
 *
 * After payment, Dodo appends ?subscription_id=sub_xxx&status=succeeded to returnUrl.
 * Always rely on webhooks (not returnUrl) to provision access.
 */
export async function createCheckoutSession(opts: CheckoutOptions): Promise<DodoCheckoutSession> {
  const isIndia = opts.countryCode === 'IN'
  const taxCtx = isIndia
    ? {
        billing_currency: 'INR',
        billing_address: { country: 'IN' },
        feature_flags: { adaptive_currency: true },
      }
    : opts.countryCode
    ? {
        billing_address: { country: opts.countryCode },
        feature_flags: { adaptive_currency: true },
      }
    : {}

  const customer = opts.customerId
    ? { customer_id: opts.customerId }
    : { email: opts.email, name: opts.name }

  const body: Record<string, unknown> = {
    product_cart: [{ product_id: opts.productId, quantity: 1 }],
    customer,
    return_url: opts.returnUrl,
    cancel_url: opts.cancelUrl,
    ...taxCtx,
    ...(opts.trialDays != null
      ? { subscription_data: { trial_period_days: opts.trialDays } }
      : {}),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
  }

  return dodoFetch<DodoCheckoutSession>('/checkouts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
