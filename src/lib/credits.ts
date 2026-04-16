import { prisma } from '@/lib/prisma'
import { wordsToCredits } from '@/types'
import { getPlanCredits } from '@/lib/plan-settings'
import type { Plan } from '@/types'

export const IMAGE_CREDITS = 5

/**
 * Check if a user has enough credits remaining.
 * Returns { allowed: true } or { allowed: false, reason }
 */
export async function checkCredits(
  userId: string,
  estimatedWordCount: number = 300,
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiCreditsTotal: true, aiCreditsUsed: true, creditsResetAt: true, lifetimeFree: true },
  })

  if (!user) return { allowed: false, reason: 'User not found' }

  if (user.lifetimeFree) return { allowed: true }

  const remaining = user.aiCreditsTotal - user.aiCreditsUsed
  const needed = wordsToCredits(estimatedWordCount)

  if (remaining < needed) {
    return {
      allowed: false,
      reason: `Insufficient credits. You need ${needed} credits but have ${remaining} remaining.`,
      remaining,
    }
  }

  return { allowed: true, remaining }
}

/**
 * Deduct credits after a successful generation.
 * Returns the actual credits deducted.
 */
export async function deductCredits(
  userId: string,
  wordCount: number,
): Promise<number> {
  const credits = wordsToCredits(wordCount)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lifetimeFree: true },
  })

  if (user?.lifetimeFree) return 0

  await prisma.user.update({
    where: { id: userId },
    data: { aiCreditsUsed: { increment: credits } },
  })

  return credits
}

/**
 * Reset monthly credits for a user (called by Razorpay webhook on subscription renewal).
 * Reads credit amount from SiteSetting (admin-configured), falls back to PLAN_CONFIG.
 * Creates an in-app notification so the user knows their credits were refreshed.
 */
export async function resetMonthlyCredits(
  userId: string,
  plan: Plan,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lifetimeFree: true },
  })

  if (user?.lifetimeFree) return

  const newTotal = await getPlanCredits(plan)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        aiCreditsUsed: 0,
        aiCreditsTotal: newTotal,
        creditsResetAt: new Date(),
      },
    }),
    prisma.notification.create({
      data: {
        userId,
        message: `Your credits have been refreshed! You now have ${newTotal} credits for this month.`,
      },
    }),
  ])
}

/**
 * Add top-up credits to a user's total (does NOT reset used count).
 */
export async function addTopupCredits(
  userId: string,
  credits: number,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { aiCreditsTotal: { increment: credits } },
  })
}
