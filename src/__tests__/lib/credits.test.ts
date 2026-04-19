import { checkCredits, deductCredits, resetMonthlyCredits, addTopupCredits } from '@/lib/credits'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  },
}))

jest.mock('@/lib/plan-settings', () => ({
  getPlanCredits: jest.fn().mockResolvedValue(10000),
}))

import { prisma } from '@/lib/prisma'
const mockPrisma = prisma as jest.Mocked<typeof prisma>

beforeEach(() => jest.clearAllMocks())

// ── checkCredits ──────────────────────────────────────────────────────────────

describe('checkCredits', () => {
  it('returns allowed=false when user not found', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    const result = await checkCredits('u1', 100)
    expect(result).toEqual({ allowed: false, reason: 'User not found' })
  })

  it('returns allowed=true for lifetimeFree users regardless of credits', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      aiCreditsTotal: 0,
      aiCreditsUsed: 0,
      lifetimeFree: true,
    })
    const result = await checkCredits('u1', 9999)
    expect(result.allowed).toBe(true)
  })

  it('returns allowed=true when sufficient credits remain', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      aiCreditsTotal: 1000,
      aiCreditsUsed: 0,
      lifetimeFree: false,
    })
    const result = await checkCredits('u1', 300) // 300 words = 6 credits
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThan(0)
  })

  it('returns allowed=false when insufficient credits', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      aiCreditsTotal: 3,
      aiCreditsUsed: 3,
      lifetimeFree: false,
    })
    const result = await checkCredits('u1', 300)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/Insufficient credits/)
    expect(result.remaining).toBe(0)
  })
})

// ── deductCredits ─────────────────────────────────────────────────────────────

describe('deductCredits', () => {
  it('returns 0 for lifetimeFree users without touching DB', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ lifetimeFree: true, aiCreditsTotal: 1000 })
    const result = await deductCredits('u1', 100)
    expect(result).toBe(0)
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('deducts credits atomically and returns the amount', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ lifetimeFree: false, aiCreditsTotal: 1000 })
    ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    const result = await deductCredits('u1', 100)
    expect(result).toBeGreaterThan(0)
    expect(mockPrisma.user.updateMany).toHaveBeenCalled()
  })

  it('throws when atomic update returns 0 rows (insufficient credits)', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ lifetimeFree: false, aiCreditsTotal: 1000 })
    ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    await expect(deductCredits('u1', 1000)).rejects.toThrow('Insufficient credits')
  })
})

// ── resetMonthlyCredits ───────────────────────────────────────────────────────

describe('resetMonthlyCredits', () => {
  it('skips reset for lifetimeFree users', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ lifetimeFree: true })
    ;(mockPrisma.$transaction as jest.Mock).mockResolvedValue([])
    await resetMonthlyCredits('u1', 'pro')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('resets credits and creates a notification for normal users', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ lifetimeFree: false })
    ;(mockPrisma.$transaction as jest.Mock).mockResolvedValue([])
    await resetMonthlyCredits('u1', 'pro')
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })
})

// ── addTopupCredits ───────────────────────────────────────────────────────────

describe('addTopupCredits', () => {
  it('increments aiCreditsTotal', async () => {
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({})
    await addTopupCredits('u1', 500)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { aiCreditsTotal: { increment: 500 } },
      }),
    )
  })
})
