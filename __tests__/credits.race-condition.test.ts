/**
 * Test: Credit deduction race condition
 *
 * Risk: Two concurrent BullMQ jobs for the same user both pass the JS-level
 * `remaining > 0` check before either writes to the DB, causing double-spend.
 *
 * The production code guards against this with prisma.user.updateMany with a
 * WHERE clause: aiCreditsUsed <= aiCreditsTotal - credits, evaluated atomically
 * inside Postgres. These tests verify that guard by controlling what updateMany
 * returns (count=1 = won the race, count=0 = lost the race).
 */

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockUpdateMany = jest.fn()
const mockFindUnique = jest.fn()

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}))

jest.mock('../src/types', () => ({
  wordsToCredits: (words: number) => Math.ceil(words / 50),
}))

jest.mock('../src/lib/plan-settings', () => ({
  getPlanCredits: jest.fn(),
}))

import { deductCredits } from '../src/lib/credits'

// ─────────────────────────────────────────────────────────────────────────────

describe('deductCredits — atomic race condition guard', () => {
  const USER_ID = 'user_race_test'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns credits deducted when updateMany matches one row (user won the race)', async () => {
    mockFindUnique.mockResolvedValue({ lifetimeFree: false, aiCreditsTotal: 1000 })
    // DB confirms the WHERE clause matched — update succeeded
    mockUpdateMany.mockResolvedValue({ count: 1 })

    const deducted = await deductCredits(USER_ID, 200) // 200 words → 4 credits

    expect(deducted).toBe(4)
    expect(mockUpdateMany).toHaveBeenCalledTimes(1)
  })

  it('throws when updateMany matches zero rows (concurrent job consumed credits first)', async () => {
    mockFindUnique.mockResolvedValue({ lifetimeFree: false, aiCreditsTotal: 100 })
    // DB says the WHERE clause did not match — another job incremented aiCreditsUsed
    // so aiCreditsUsed + credits > aiCreditsTotal at commit time
    mockUpdateMany.mockResolvedValue({ count: 0 })

    await expect(deductCredits(USER_ID, 5000)).rejects.toThrow('Insufficient credits')
  })

  it('returns 0 and does not call updateMany for lifetimeFree users', async () => {
    mockFindUnique.mockResolvedValue({ lifetimeFree: true, aiCreditsTotal: 0 })

    const deducted = await deductCredits(USER_ID, 300)

    expect(deducted).toBe(0)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('correctly handles two concurrent calls where the second loses the race', async () => {
    mockFindUnique.mockResolvedValue({ lifetimeFree: false, aiCreditsTotal: 10 })

    // First concurrent call wins — DB row matched
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    // Second concurrent call loses — DB row no longer matched
    mockUpdateMany.mockResolvedValueOnce({ count: 0 })

    const first = await deductCredits(USER_ID, 450) // 9 credits
    await expect(deductCredits(USER_ID, 100)).rejects.toThrow('Insufficient credits')

    expect(first).toBe(9)
    expect(mockUpdateMany).toHaveBeenCalledTimes(2)
  })

  it('always delegates the credit guard to the DB regardless of JS-level credit snapshot', async () => {
    // JS snapshot says 500 credits remain — but we must still call updateMany,
    // never short-circuit based on the stale JS value
    mockFindUnique.mockResolvedValue({ lifetimeFree: false, aiCreditsTotal: 1000 })
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await deductCredits(USER_ID, 100) // 2 credits

    expect(mockUpdateMany).toHaveBeenCalledTimes(1)
  })

  it('passes the correct WHERE condition so the DB can enforce the credit ceiling', async () => {
    mockFindUnique.mockResolvedValue({ lifetimeFree: false, aiCreditsTotal: 500 })
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await deductCredits(USER_ID, 100) // 2 credits

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: USER_ID,
          aiCreditsUsed: { lte: 498 }, // 500 total - 2 credits = 498
        }),
        data: { aiCreditsUsed: { increment: 2 } },
      })
    )
  })
})
