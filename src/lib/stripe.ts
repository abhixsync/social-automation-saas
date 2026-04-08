import Stripe from 'stripe'
import type { Plan, Currency } from '@/generated/prisma/enums'
import { PLAN_CONFIG, TOPUP_CREDITS } from '@/types'

// Lazy singleton — prevents build-time crash when STRIPE_SECRET_KEY is absent
let _stripe: Stripe | null = null
function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-03-31.basil',
      typescript: true,
    })
  }
  return _stripe
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_, prop: string | symbol) {
    return Reflect.get(getStripeClient(), prop)
  },
})

// ─── Price ID lookups ─────────────────────────────────────────────────────────

export function getPriceId(plan: Exclude<Plan, 'free'>, currency: Currency): string {
  const key = `STRIPE_${plan.toUpperCase()}_PRICE_${currency}` as keyof NodeJS.ProcessEnv
  const priceId = process.env[key]
  if (!priceId) throw new Error(`Missing env var: ${key}`)
  return priceId
}

export function getTopupPriceId(currency: Currency): string {
  const key = `STRIPE_TOPUP_PRICE_${currency}` as keyof NodeJS.ProcessEnv
  const priceId = process.env[key]
  if (!priceId) throw new Error(`Missing env var: ${key}`)
  return priceId
}

// Build a reverse map: priceId → { plan, currency }
export function buildPriceMap(): Map<string, { plan: Plan; currency: Currency }> {
  const map = new Map<string, { plan: Plan; currency: Currency }>()
  const plans: Exclude<Plan, 'free'>[] = ['starter', 'growth', 'pro']
  const currencies: Currency[] = ['INR', 'USD']
  for (const plan of plans) {
    for (const currency of currencies) {
      try {
        const priceId = getPriceId(plan, currency)
        if (priceId) map.set(priceId, { plan, currency })
      } catch {
        // env var not set — skip
      }
    }
  }
  return map
}

// ─── Customer helpers ──────────────────────────────────────────────────────────

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name: string | null,
  existingCustomerId: string | null,
): Promise<string> {
  if (existingCustomerId) return existingCustomerId

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  })

  return customer.id
}

// ─── Plan config helpers ───────────────────────────────────────────────────────

export function getCreditsForPlan(plan: Plan): number {
  return PLAN_CONFIG[plan].creditsPerMonth
}

export { TOPUP_CREDITS }
