import { dodoFetch } from './client.js'
import { buildTaxContext } from './currency.js'
import type { CreateCheckoutOptions, DodoCheckoutSession } from './types.js'

/**
 * Create a hosted Dodo checkout session for a subscription plan.
 * Returns a checkout_url — redirect the customer there to complete payment.
 *
 * After payment Dodo appends to return_url:
 *   ?subscription_id=sub_xxx&status=succeeded&email=customer@example.com
 *
 * Listen for subscription.active webhook to reliably provision access
 * (the return_url redirect can be skipped by the user closing the tab).
 */
export async function createCheckoutSession(
  opts: CreateCheckoutOptions,
): Promise<DodoCheckoutSession> {
  const taxCtx = buildTaxContext(opts.countryCode, opts.taxId)

  // Re-use existing Dodo customer record when available to preserve payment methods
  const customer = opts.customer.customerId
    ? { customer_id: opts.customer.customerId }
    : { email: opts.customer.email, name: opts.customer.name }

  const body: Record<string, unknown> = {
    product_cart: [{ product_id: opts.productId, quantity: opts.quantity ?? 1 }],
    customer,
    return_url: opts.returnUrl,
    cancel_url: opts.cancelUrl,
    ...taxCtx,
    ...(opts.trialDays != null ? { subscription_data: { trial_period_days: opts.trialDays } } : {}),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
  }

  return dodoFetch<DodoCheckoutSession>('/checkouts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
