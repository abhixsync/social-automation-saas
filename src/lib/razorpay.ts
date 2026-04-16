import Razorpay from 'razorpay'
import type { Plan, Currency } from '@/types'

// Lazy singleton — only instantiated at request time, not at build time
let _razorpay: Razorpay | null = null
export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
  }
  return _razorpay
}

// Returns the Razorpay Plan ID for pro plan + currency
export function getPlanId(plan: 'pro', currency: Currency): string {
  const key = `RAZORPAY_PRO_PLAN_${currency}` as keyof NodeJS.ProcessEnv
  const id = process.env[key]
  if (!id) throw new Error(`Missing env var: ${key}`)
  return id
}

// Top-up amounts in smallest unit (paise / cents)
export const TOPUP_AMOUNT: Record<Currency, number> = {
  INR: 99900,   // ₹999 in paise
  USD: 999,     // $9.99 in cents
}

// Currency to Razorpay currency code
export const RAZORPAY_CURRENCY: Record<Currency, string> = {
  INR: 'INR',
  USD: 'USD',
}

// Verify Razorpay webhook signature
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const crypto = require('crypto') as typeof import('crypto')
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')
  return expected === signature
}

// Verify payment signature for one-time orders (top-up)
export function verifyOrderPayment(orderId: string, paymentId: string, signature: string): boolean {
  const crypto = require('crypto') as typeof import('crypto')
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return expected === signature
}
