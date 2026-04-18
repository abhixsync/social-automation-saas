import express from 'express'
import { Pool } from 'pg'
import {
  createCheckoutSession,
  getActiveSubscription,
  cancelSubscription,
  changePlan,
  createDodoWebhookHandler,
  detectCurrency,
  DodoApiError,
} from './dodo/index.js'

const app = express()
const db = new Pool({ connectionString: process.env.DATABASE_URL })

// ── Webhook — MUST be before express.json() (needs raw body for sig verification)
app.post('/webhooks/dodo', express.raw({ type: 'application/json' }), createDodoWebhookHandler(db))

app.use(express.json())

// ── Checkout ───────────────────────────────────────────────────────────────────

/**
 * POST /billing/checkout
 * Body: { productId, email, name, countryCode, userId, taxId?, trialDays?, customerId? }
 * Returns: { checkoutUrl }
 */
app.post('/billing/checkout', async (req, res) => {
  const { productId, email, name, countryCode, userId, taxId, trialDays, customerId } = req.body

  try {
    const session = await createCheckoutSession({
      productId,
      customer: { email, name, customerId },
      returnUrl: `${process.env.APP_URL}/billing/success`,
      cancelUrl:  `${process.env.APP_URL}/billing/cancel`,
      countryCode,
      taxId,
      trialDays,
      metadata: { user_id: userId },   // echoed back in every webhook event
    })
    res.json({ checkoutUrl: session.checkout_url })
  } catch (err) {
    const status = err instanceof DodoApiError ? err.status : 500
    res.status(status).json({ error: (err as Error).message })
  }
})

// ── Subscription management ────────────────────────────────────────────────────

/** GET /billing/subscription?customerId=cust_xxx */
app.get('/billing/subscription', async (req, res) => {
  const { customerId } = req.query as { customerId: string }
  try {
    const sub = await getActiveSubscription(customerId)
    res.json({ subscription: sub })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

/**
 * POST /billing/cancel
 * Body: { subscriptionId, immediately? }
 *
 * immediately: false (default) = cancel at period end (customer keeps access until then)
 * immediately: true            = revoke access now
 */
app.post('/billing/cancel', async (req, res) => {
  const { subscriptionId, immediately } = req.body
  try {
    const sub = await cancelSubscription(subscriptionId, { immediately })
    res.json({ subscription: sub })
  } catch (err) {
    const status = err instanceof DodoApiError ? err.status : 500
    res.status(status).json({ error: (err as Error).message })
  }
})

/**
 * POST /billing/change-plan
 * Body: { subscriptionId, newProductId, proration?, effectiveAt? }
 *
 * proration:   'prorated_immediately' (default) | 'full_immediately' | 'do_not_bill'
 * effectiveAt: 'immediately' (default) | 'next_billing_date'
 */
app.post('/billing/change-plan', async (req, res) => {
  const { subscriptionId, newProductId, proration, effectiveAt } = req.body
  try {
    const sub = await changePlan(subscriptionId, { newProductId, proration, effectiveAt })
    res.json({ subscription: sub })
  } catch (err) {
    const status = err instanceof DodoApiError ? err.status : 500
    res.status(status).json({ error: (err as Error).message })
  }
})

// ── Utility ────────────────────────────────────────────────────────────────────

/** GET /billing/currency?country=IN → { currency: 'INR' } */
app.get('/billing/currency', (req, res) => {
  const country = (req.query.country as string) ?? 'US'
  res.json({ currency: detectCurrency(country) })
})

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

export default app
