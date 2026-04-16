import { prisma } from '@/lib/prisma'
import { PLAN_CONFIG } from '@/types'
import type { Plan } from '@/types'

export const PLAN_SETTING_KEYS: Record<Plan, string> = {
  free: 'free_credits_per_month',
  pro: 'pro_credits_per_month',
}

/**
 * Returns the admin-configured credits for a plan.
 * Falls back to PLAN_CONFIG defaults if no SiteSetting exists.
 */
export async function getPlanCredits(plan: Plan): Promise<number> {
  const key = PLAN_SETTING_KEYS[plan]
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } })
    if (row) {
      const parsed = parseInt(row.value, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  } catch {
    // DB unavailable — fall back to static config
  }
  return PLAN_CONFIG[plan].creditsPerMonth
}

/**
 * Returns all plan credit settings (for admin UI).
 */
export async function getAllPlanCredits(): Promise<Record<Plan, number>> {
  const keys = Object.values(PLAN_SETTING_KEYS)
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } })
  const map: Record<string, number> = {}
  rows.forEach((r) => { map[r.key] = parseInt(r.value, 10) || 0 })

  return {
    free: map[PLAN_SETTING_KEYS.free] || PLAN_CONFIG.free.creditsPerMonth,
    pro: map[PLAN_SETTING_KEYS.pro] || PLAN_CONFIG.pro.creditsPerMonth,
  }
}
