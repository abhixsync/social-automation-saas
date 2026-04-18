/**
 * Test: checkExpiringTokens — warning window detection
 *
 * The worker imports prisma as '../lib/prisma.js' (ESM extension).
 * Variables prefixed with 'mock' can be referenced in jest.mock factories
 * even after hoisting (Jest special-cases them).
 */

// ─── Mock handles ─────────────────────────────────────────────────────────────
// Must be prefixed with 'mock' to be accessible inside hoisted jest.mock factories

const mockFindMany = jest.fn()
const mockSendTokenExpiryWarning = jest.fn()

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../worker/src/lib/prisma', () => ({
  prisma: {
    linkedInAccount: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
  },
}))

jest.mock('../worker/src/lib/email', () => ({
  sendTokenExpiryWarning: (...a: unknown[]) => mockSendTokenExpiryWarning(...a),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

// ─────────────────────────────────────────────────────────────────────────────

describe('checkExpiringTokens — warning window detection', () => {
  beforeEach(() => {
    mockFindMany.mockReset()
    mockSendTokenExpiryWarning.mockReset()
    mockFindMany.mockResolvedValue([])
    mockSendTokenExpiryWarning.mockResolvedValue(undefined)
  })

  it('sends warning email when account expires in ~7 days', async () => {
    const expiresAt = daysFromNow(7)
    mockFindMany
      .mockResolvedValueOnce([
        { id: 'acc_001', expiresAt, user: { email: 'user@test.com', name: 'Test' } },
      ])
      .mockResolvedValueOnce([])

    const { checkExpiringTokens } = await import('../worker/src/jobs/check-expiring-tokens')
    await checkExpiringTokens()

    expect(mockSendTokenExpiryWarning).toHaveBeenCalledWith('user@test.com', 'Test', expect.any(Number))
  })

  it('sends warning email when account expires in ~2 days', async () => {
    const expiresAt = daysFromNow(2)
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'acc_002', expiresAt, user: { email: 'user@test.com', name: 'Test' } },
      ])

    const { checkExpiringTokens } = await import('../worker/src/jobs/check-expiring-tokens')
    await checkExpiringTokens()

    expect(mockSendTokenExpiryWarning).toHaveBeenCalledTimes(1)
  })

  it('does not send email when no accounts are expiring', async () => {
    mockFindMany.mockResolvedValue([])

    const { checkExpiringTokens } = await import('../worker/src/jobs/check-expiring-tokens')
    await checkExpiringTokens()

    expect(mockSendTokenExpiryWarning).not.toHaveBeenCalled()
  })

  it('skips account with no email address without throwing', async () => {
    const expiresAt = daysFromNow(7)
    mockFindMany
      .mockResolvedValueOnce([
        { id: 'acc_003', expiresAt, user: { email: null, name: null } },
      ])
      .mockResolvedValueOnce([])

    const { checkExpiringTokens } = await import('../worker/src/jobs/check-expiring-tokens')
    await expect(checkExpiringTokens()).resolves.not.toThrow()
    expect(mockSendTokenExpiryWarning).not.toHaveBeenCalled()
  })

  it('continues processing remaining accounts when one email send fails', async () => {
    const expiresAt = daysFromNow(7)
    mockSendTokenExpiryWarning
      .mockRejectedValueOnce(new Error('SMTP timeout'))
      .mockResolvedValueOnce(undefined)

    mockFindMany
      .mockResolvedValueOnce([
        { id: 'acc_004', expiresAt, user: { email: 'a@test.com', name: 'A' } },
        { id: 'acc_005', expiresAt, user: { email: 'b@test.com', name: 'B' } },
      ])
      .mockResolvedValueOnce([])

    const { checkExpiringTokens } = await import('../worker/src/jobs/check-expiring-tokens')
    await expect(checkExpiringTokens()).resolves.not.toThrow()
    expect(mockSendTokenExpiryWarning).toHaveBeenCalledTimes(2)
  })

  it('reports the correct number of days remaining in the warning email', async () => {
    const expiresAt = daysFromNow(7)
    mockFindMany
      .mockResolvedValueOnce([
        { id: 'acc_001', expiresAt, user: { email: 'user@test.com', name: 'Test' } },
      ])
      .mockResolvedValueOnce([])

    const { checkExpiringTokens } = await import('../worker/src/jobs/check-expiring-tokens')
    await checkExpiringTokens()

    const daysArg = mockSendTokenExpiryWarning.mock.calls[0][2] as number
    expect(daysArg).toBeGreaterThanOrEqual(6)
    expect(daysArg).toBeLessThanOrEqual(8)
  })
})
