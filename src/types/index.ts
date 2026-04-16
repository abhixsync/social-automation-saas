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
}

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: {
    name: 'Free',
    creditsPerMonth: 1000,    // 50,000 words ≈ 200 posts (configurable via admin)
    maxAccounts: 1,
    model: 'llama_3_3_70b',
    priceINR: 0,
    priceUSD: 0,
  },
  pro: {
    name: 'Pro',
    creditsPerMonth: 10000,   // 500,000 words ≈ 2000 posts (configurable via admin)
    maxAccounts: 10,
    model: 'claude_sonnet',
    priceINR: 999,
    priceUSD: 11.99,
  },
}

// 1 credit = 50 words
export const WORDS_PER_CREDIT = 50
export const TOPUP_CREDITS = 500          // credits per top-up purchase
export const TOPUP_PRICE_INR = 99         // ₹99
export const TOPUP_PRICE_USD = 99         // $0.99 in cents

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
