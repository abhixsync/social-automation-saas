import { dodoFetch } from './client.js'
import type { CancelSubscriptionOptions, ChangePlanOptions, DodoSubscription } from './types.js'

export async function getSubscription(subscriptionId: string): Promise<DodoSubscription> {
  return dodoFetch<DodoSubscription>(`/subscriptions/${subscriptionId}`)
}

export async function listSubscriptions(
  customerId: string,
  opts: {
    status?: DodoSubscription['status']
    pageSize?: number
    pageNumber?: number
  } = {},
): Promise<DodoSubscription[]> {
  const params = new URLSearchParams({ customer_id: customerId })
  if (opts.status) params.set('status', opts.status)
  if (opts.pageSize != null) params.set('page_size', String(opts.pageSize))
  if (opts.pageNumber != null) params.set('page_number', String(opts.pageNumber))

  const res = await dodoFetch<{ items: DodoSubscription[] }>(`/subscriptions?${params}`)
  return res.items ?? []
}

/** Returns the first active subscription for a customer, or null if none. */
export async function getActiveSubscription(customerId: string): Promise<DodoSubscription | null> {
  const subs = await listSubscriptions(customerId, { status: 'active', pageSize: 1 })
  return subs[0] ?? null
}

/**
 * Cancel a subscription.
 *
 * Default (immediately: false): cancel at next billing date — customer keeps
 * access until the current period ends. Preferred for self-serve cancellation.
 *
 * Pass immediately: true to revoke access right now (use for fraud/abuse).
 */
export async function cancelSubscription(
  subscriptionId: string,
  opts: CancelSubscriptionOptions = {},
): Promise<DodoSubscription> {
  const body: Record<string, unknown> = {
    cancel_at_next_billing_date: !opts.immediately,
    cancel_reason: opts.reason ?? 'cancelled_by_customer',
  }
  // Immediate cancellation also sets status directly
  if (opts.immediately) body.status = 'cancelled'

  return dodoFetch<DodoSubscription>(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

/**
 * Upgrade or downgrade a subscription to a different plan.
 *
 * Default: prorate and charge/credit the difference immediately.
 * onPaymentFailure: 'prevent_change' means the plan stays unchanged if
 * the prorated charge fails — safe default for upgrades.
 */
export async function changePlan(
  subscriptionId: string,
  opts: ChangePlanOptions,
): Promise<DodoSubscription> {
  return dodoFetch<DodoSubscription>(`/subscriptions/${subscriptionId}/change-plan`, {
    method: 'POST',
    body: JSON.stringify({
      product_id: opts.newProductId,
      quantity: opts.quantity ?? 1,
      proration_billing_mode: opts.proration ?? 'prorated_immediately',
      effective_at: opts.effectiveAt ?? 'immediately',
      on_payment_failure: opts.onPaymentFailure ?? 'prevent_change',
      ...(opts.metadata ? { metadata: opts.metadata } : {}),
    }),
  })
}
