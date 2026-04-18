/**
 * Test: Rate limiting
 *
 * Risk: If checkRateLimit fails open silently or has an off-by-one on the
 * window/limit, an attacker can hammer the approve endpoint (which triggers
 * credit deductions and LinkedIn API calls) far beyond the intended 10 req/60s.
 *
 * The production implementation uses Redis INCR + EXPIRE in a single pipeline.
 * These tests verify the allow/block logic and the fail-closed/fail-open options.
 */

// ─── Redis mock ───────────────────────────────────────────────────────────────

const mockExec = jest.fn()
const mockMulti = jest.fn(() => ({
  incr: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: mockExec,
}))
const mockRedis = { multi: mockMulti }

jest.mock('../src/lib/scheduler', () => ({
  getRedis: () => mockRedis,
}))

import { checkRateLimit, getClientIp } from '../src/lib/ratelimit'

// ─────────────────────────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allows the request when the counter is below the limit', async () => {
    // count=5, limit=10 → allowed
    mockExec.mockResolvedValue([[null, 5], [null, 1]])

    const result = await checkRateLimit('approve:user_001', 10, 60)

    expect(result.allowed).toBe(true)
  })

  it('allows the request when the counter equals the limit (inclusive)', async () => {
    // count=10, limit=10 → allowed (boundary: count <= limit)
    mockExec.mockResolvedValue([[null, 10], [null, 1]])

    const result = await checkRateLimit('approve:user_001', 10, 60)

    expect(result.allowed).toBe(true)
  })

  it('blocks the request when the counter exceeds the limit', async () => {
    // count=11, limit=10 → blocked
    mockExec.mockResolvedValue([[null, 11], [null, 1]])

    const result = await checkRateLimit('approve:user_001', 10, 60)

    expect(result.allowed).toBe(false)
  })

  it('fails closed (blocks) when Redis throws and no failOpen option is set', async () => {
    mockExec.mockRejectedValue(new Error('Redis connection refused'))

    const result = await checkRateLimit('approve:user_001', 10, 60)

    expect(result.allowed).toBe(false)
  })

  it('fails open (allows) when Redis throws and failOpen option is true', async () => {
    mockExec.mockRejectedValue(new Error('Redis connection refused'))

    const result = await checkRateLimit('approve:user_001', 10, 60, { failOpen: true })

    expect(result.allowed).toBe(true)
  })

  it('uses the rl: prefix in the Redis key to namespace rate-limit keys', async () => {
    mockExec.mockResolvedValue([[null, 1], [null, 1]])
    const incrSpy = jest.fn().mockReturnThis()
    mockMulti.mockReturnValue({ incr: incrSpy, expire: jest.fn().mockReturnThis(), exec: mockExec })

    await checkRateLimit('approve:user_abc', 10, 60)

    expect(incrSpy).toHaveBeenCalledWith('rl:approve:user_abc')
  })

  it('uses the provided windowSecs for the EXPIRE call', async () => {
    mockExec.mockResolvedValue([[null, 1], [null, 1]])
    const expireSpy = jest.fn().mockReturnThis()
    mockMulti.mockReturnValue({ incr: jest.fn().mockReturnThis(), expire: expireSpy, exec: mockExec })

    await checkRateLimit('some:key', 5, 120)

    expect(expireSpy).toHaveBeenCalledWith('rl:some:key', 120)
  })

  it('blocks at the first request when limit is 0', async () => {
    // count=1, limit=0 → 1 > 0 → blocked
    mockExec.mockResolvedValue([[null, 1], [null, 1]])

    const result = await checkRateLimit('approve:user_001', 0, 60)

    expect(result.allowed).toBe(false)
  })

  it('issues exactly one MULTI/EXEC round-trip per call (atomic pipeline)', async () => {
    mockExec.mockResolvedValue([[null, 3], [null, 1]])

    await checkRateLimit('approve:user_001', 10, 60)

    expect(mockMulti).toHaveBeenCalledTimes(1)
    expect(mockExec).toHaveBeenCalledTimes(1)
  })
})

// ─── getClientIp ──────────────────────────────────────────────────────────────

describe('getClientIp', () => {
  it('extracts the first IP from x-forwarded-for when multiple IPs are present', () => {
    const req = { headers: { get: (name: string) => name === 'x-forwarded-for' ? '1.2.3.4, 5.6.7.8' : null } }
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('returns the IP directly when x-forwarded-for has a single value', () => {
    const req = { headers: { get: (name: string) => name === 'x-forwarded-for' ? '9.9.9.9' : null } }
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('returns "unknown" when x-forwarded-for header is missing', () => {
    const req = { headers: { get: () => null } }
    expect(getClientIp(req)).toBe('unknown')
  })

  it('trims whitespace from the extracted IP', () => {
    const req = { headers: { get: (name: string) => name === 'x-forwarded-for' ? '  10.0.0.1 , 192.168.1.1' : null } }
    expect(getClientIp(req)).toBe('10.0.0.1')
  })
})
