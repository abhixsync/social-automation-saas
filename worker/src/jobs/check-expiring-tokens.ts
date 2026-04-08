import { prisma } from '../lib/prisma.js'
import { sendTokenExpiryWarning } from '../lib/email.js'

// Warn users at 7 days and again at 2 days before expiry
const WARN_THRESHOLDS_DAYS = [7, 2]

export async function checkExpiringTokens(): Promise<void> {
  const now = new Date()

  for (const daysLeft of WARN_THRESHOLDS_DAYS) {
    // Find accounts whose token expires within a 25-hour window around this threshold
    // (daily job ±30min drift tolerance via 25h window)
    const windowStart = new Date(now.getTime() + (daysLeft - 1) * 24 * 60 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000 + 60 * 60 * 1000)

    const accounts = await prisma.linkedInAccount.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: { email: true, name: true },
        },
      },
    })

    if (accounts.length > 0) {
      console.log(`[worker] ${accounts.length} account(s) expiring in ~${daysLeft} day(s)`)
    }

    for (const account of accounts) {
      const actualDaysLeft = Math.ceil(
        (account.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      )
      const email = account.user.email
      if (!email) continue

      try {
        await sendTokenExpiryWarning(email, account.user.name, actualDaysLeft)
        console.log(`[worker] Sent expiry warning to ${email} (${actualDaysLeft} days left)`)
      } catch (err) {
        console.error(`[worker] Failed to send expiry email to ${email}:`, err)
      }
    }
  }
}
