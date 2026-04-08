import { prisma } from '@/lib/prisma'
import { wordsToCredits } from '@/types'

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
    select: { aiCreditsTotal: true, aiCreditsUsed: true, creditsResetAt: true },
  })

  if (!user) return { allowed: false, reason: 'User not found' }

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

  await prisma.user.update({
    where: { id: userId },
    data: { aiCreditsUsed: { increment: credits } },
  })

  return credits
}

/**
 * Reset monthly credits for a user (called by Stripe webhook on subscription renewal).
 */
export async function resetMonthlyCredits(
  userId: string,
  newTotal: number,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      aiCreditsUsed: 0,
      aiCreditsTotal: newTotal,
      creditsResetAt: new Date(),
    },
  })
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
