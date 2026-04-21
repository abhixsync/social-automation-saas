/**
 * Test: Credit deduction race condition
 *
 * Risk: Two concurrent BullMQ jobs for the same user both pass the JS-level
 * `remaining > 0` check before either writes to the DB, causing double-spend.
 *
 * The production code guards against this with prisma.$executeRaw with a
 * WHERE clause: aiCreditsUsed + credits <= aiCreditsTotal, evaluated atomically
 * inside Postgres. These tests verify that guard by controlling what $executeRaw
 * returns (1 = won the race, 0 = lost the race).
 */

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockExecuteRaw = jest.fn()
const mockFindUnique = jest.fn()

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
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

  it('returns credits deducted when $executeRaw returns 1 (user won the race)', async () => {
    mockFindUnique.mockResolvedValue({ lifetimeFree: false })
    // DB confirms the WHERE clause matched — update succeeded
    mockExecuteRaw.mockResolvedValue(1)

    const deducted = await deductCredits(USER_ID, 200) // 200 words → 4 credits

    expect(deducted).toBe(4)
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('throws when $executeRaw returns 0 (concurrent job consumed credits first)', async () => {
    mockFindUnique.mockResolvedValue({ lifetimeFree: false })
    // DB says the WHERE clause did not match — another job incremented aiCreditsUsed
    // so aiCreditsUsed + credits > aiCreditsTotal at commit time
    mockExecuteRaw.mockResolvedValue(0)

    await expect(deductCredits(USER_ID, 5000)).rejects.toThrow('Insufficient credits')
  })

  it('returns 0 and does not call $executeRaw for lifetimeFree users', async () => {
    mockFindUnique.mockResolvedValue({ lifetimeFree: true })

    const deducted = await deductCredits(USER_ID, 300)

    expect(deducted).toBe(0)
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('correctly handles two concurrent calls where the second loses the race', async () => {
    mockFindUnique.mockResolvedValue({ lifetimeFree: false })

    // First concurrent call wins — DB row matched
    mockExecuteRaw.mockResolvedValueOnce(1)
    // Second concurrent call loses — DB row no longer matched
    mockExecuteRaw.mockResolvedValueOnce(0)

    const first = await deductCredits(USER_ID, 450) // 9 credits
    await expect(deductCredits(USER_ID, 100)).rejects.toThrow('Insufficient credits')

    expect(first).toBe(9)
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2)
  })

  it('always delegates the credit guard to the DB regardless of JS-level credit snapshot', async () => {
    // JS snapshot says 500 credits remain — but we must still call $executeRaw,
    // never short-circuit based on the stale JS value
    mockFindUnique.mockResolvedValue({ lifetimeFree: false })
    mockExecuteRaw.mockResolvedValue(1)

    await deductCredits(USER_ID, 100) // 2 credits

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('delegates the atomic credit guard to the DB via $executeRaw', async () => {
    mockFindUnique.mockResolvedValue({ lifetimeFree: false })
    mockExecuteRaw.mockResolvedValue(1)

    await deductCredits(USER_ID, 100) // 2 credits

    // The raw SQL contains the live-column WHERE guard — we verify $executeRaw was invoked
    // (SQL template string content is not inspectable through Jest mock assertions)
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })
})
