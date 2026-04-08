import type { Plan, Currency, Tone, PostStatus, AIModel } from '@/generated/prisma/enums'

export type { Plan, Currency, Tone, PostStatus, AIModel }

// ─── Plan config ─────────────────────────────────────────────────────────────

export interface PlanConfig {
  name: string
  creditsPerMonth: number   // 1 credit = 50 words
  maxAccounts: number
  model: AIModel
  priceINR: number          // monthly price in INR (0 = free)
  priceUSD: number          // monthly price in USD (0 = free)
  stripePriceIdINR: string | null
  stripePriceIdUSD: string | null
}

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: {
    name: 'Free',
    creditsPerMonth: 40,      // 2,000 words ≈ 10 posts
    maxAccounts: 1,
    model: 'llama_3_1_8b',
    priceINR: 0,
    priceUSD: 0,
    stripePriceIdINR: null,
    stripePriceIdUSD: null,
  },
  starter: {
    name: 'Starter',
    creditsPerMonth: 500,     // 25,000 words ≈ 100 posts
    maxAccounts: 1,
    model: 'llama_3_3_70b',
    priceINR: 499,
    priceUSD: 6,
    stripePriceIdINR: process.env.STRIPE_STARTER_PRICE_INR ?? null,
    stripePriceIdUSD: process.env.STRIPE_STARTER_PRICE_USD ?? null,
  },
  growth: {
    name: 'Growth',
    creditsPerMonth: 1200,    // 60,000 words ≈ 250 posts
    maxAccounts: 2,
    model: 'llama_3_3_70b',
    priceINR: 999,
    priceUSD: 12,
    stripePriceIdINR: process.env.STRIPE_GROWTH_PRICE_INR ?? null,
    stripePriceIdUSD: process.env.STRIPE_GROWTH_PRICE_USD ?? null,
  },
  pro: {
    name: 'Pro',
    creditsPerMonth: 3000,    // 150,000 words ≈ 600 posts
    maxAccounts: 5,
    model: 'claude_sonnet',
    priceINR: 2499,
    priceUSD: 29,
    stripePriceIdINR: process.env.STRIPE_PRO_PRICE_INR ?? null,
    stripePriceIdUSD: process.env.STRIPE_PRO_PRICE_USD ?? null,
  },
}

// 1 credit = 50 words
export const WORDS_PER_CREDIT = 50
export const TOPUP_CREDITS = 100          // credits per top-up purchase
export const TOPUP_PRICE_INR = 99         // ₹99
export const TOPUP_PRICE_USD = 120        // $1.20 in cents

// Credits used = ceil(wordCount / WORDS_PER_CREDIT)
export function wordsToCredits(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_CREDIT)
}

export function creditsToWords(credits: number): number {
  return credits * WORDS_PER_CREDIT
}

// ─── API response types ───────────────────────────────────────────────────────

export interface ApiError {
  error: string
  code?: string
}

export interface ApiSuccess<T = void> {
  data?: T
  message?: string
}

// ─── Dashboard types ──────────────────────────────────────────────────────────

export interface CreditSummary {
  used: number
  total: number
  remaining: number
  percentUsed: number
  resetsAt: Date
}

export interface LinkedInAccountSummary {
  id: string
  displayName: string | null
  profilePicture: string | null
  isActive: boolean
  expiresAt: Date
  daysUntilExpiry: number
}
