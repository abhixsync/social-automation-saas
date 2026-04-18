import { dodoFetch } from './client'

export interface DodoSubscription {
  subscription_id: string
  customer_id: string
  status: 'active' | 'cancelled' | 'on_hold' | 'paused' | 'expired'
  product_id: string
  current_period_end: string
}

/**
 * Cancel a subscription at the next billing date (customer keeps access until then).
 * Pass immediately: true to revoke access now (fraud/abuse only).
 */
export async function cancelSubscription(
  subscriptionId: string,
  opts: { immediately?: boolean } = {},
): Promise<DodoSubscription> {
  const body: Record<string, unknown> = {
    cancel_at_next_billing_date: !opts.immediately,
    cancel_reason: 'cancelled_by_customer',
  }
  if (opts.immediately) body.status = 'cancelled'

  return dodoFetch<DodoSubscription>(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
