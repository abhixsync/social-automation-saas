export type DodoCurrency = 'INR' | 'USD'

/**
 * Indian customers → INR (GST applies, collected by you as the Indian entity).
 * Everyone else   → USD (Dodo acts as Merchant of Record and handles VAT/sales tax).
 *
 * IMPORTANT: billing_currency only takes effect when Adaptive Pricing is enabled
 * in your Dodo dashboard (Dashboard → Settings → Adaptive Pricing).
 * Without it, Dodo uses whichever currency the product was created in.
 */
export function detectCurrency(countryCode: string): DodoCurrency {
  return countryCode.toUpperCase() === 'IN' ? 'INR' : 'USD'
}

interface TaxContext {
  billing_currency: DodoCurrency
  billing_address: { country: string }
  tax_id?: string
  feature_flags: {
    allow_tax_id: boolean
    allow_customer_editing_tax_id: boolean
  }
}

/**
 * Build the currency + tax fields to merge into a POST /checkouts request body.
 *
 * @param countryCode  ISO 3166-1 alpha-2 (e.g. 'IN', 'US', 'DE')
 * @param taxId        Optional: GST number for Indian B2B, VAT number for EU, etc.
 */
export function buildTaxContext(countryCode: string, taxId?: string): TaxContext {
  const ctx: TaxContext = {
    billing_currency: detectCurrency(countryCode),
    billing_address: { country: countryCode.toUpperCase() },
    feature_flags: {
      allow_tax_id: true,                  // B2B customers should be able to enter their tax ID
      allow_customer_editing_tax_id: true,
    },
  }
  if (taxId) ctx.tax_id = taxId
  return ctx
}
