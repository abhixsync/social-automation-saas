import { cache } from 'react'
import { prisma } from './prisma'

/**
 * React-cached data loaders for dashboard server components.
 * React deduplicates calls with identical args within the same request,
 * so layout + page can both call these without doubling DB queries.
 */

export const getDbUser = cache(async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { aiCreditsUsed: true, aiCreditsTotal: true, plan: true, lifetimeFree: true },
  }),
)

export const getActiveLinkedInAccounts = cache(async (userId: string) =>
  prisma.linkedInAccount.findMany({
    where: { userId, isActive: true },
    select: { id: true, displayName: true },
  }),
)

export const getUserPreferences = cache(async (userId: string) =>
  prisma.userPreferences.findUnique({
    where: { userId },
    select: { contentPillars: true, niche: true },
  }),
)

export const getActiveSchedule = cache(async (userId: string) =>
  prisma.postSchedule.findFirst({
    where: { userId, isActive: true },
  }),
)
