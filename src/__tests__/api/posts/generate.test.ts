import { NextRequest } from 'next/server'
import { POST } from '@/app/api/posts/generate/route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    linkedInAccount: { findFirst: jest.fn() },
    user: { findUnique: jest.fn(), updateMany: jest.fn() },
  },
}))

jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
}))

jest.mock('@/lib/scheduler', () => ({
  getPostQueue: jest.fn().mockReturnValue({ add: jest.fn().mockResolvedValue({}) }),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'
import { getPostQueue } from '@/lib/scheduler'

const mockAuth = auth as jest.Mock
const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockRateLimit = checkRateLimit as jest.Mock

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/posts/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const FUTURE = new Date(Date.now() + 86400_000) // 24h from now

beforeEach(() => {
  jest.clearAllMocks()
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockAuth.mockResolvedValue({ user: { id: 'user_1' } })
  ;(mockPrisma.linkedInAccount.findFirst as jest.Mock).mockResolvedValue({
    id: 'acc_1',
    expiresAt: FUTURE,
  })
  ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
    aiCreditsUsed: 0,
    aiCreditsTotal: 1000,
    lifetimeFree: false,
  })
  ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
})

describe('POST /api/posts/generate', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makeReq({ accountId: 'acc_1' }))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(makeReq({ accountId: 'acc_1' }))
    expect(res.status).toBe(429)
  })

  it('returns 404 when account not found or not owned by user', async () => {
    ;(mockPrisma.linkedInAccount.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ accountId: 'acc_other' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when LinkedIn token has expired', async () => {
    ;(mockPrisma.linkedInAccount.findFirst as jest.Mock).mockResolvedValue({
      id: 'acc_1',
      expiresAt: new Date(Date.now() - 1000),
    })
    const res = await POST(makeReq({ accountId: 'acc_1' }))
    expect(res.status).toBe(400)
  })

  it('returns 402 when user has no credits', async () => {
    ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    const res = await POST(makeReq({ accountId: 'acc_1' }))
    expect(res.status).toBe(402)
  })

  it('enqueues job and returns 200 for valid request', async () => {
    const res = await POST(makeReq({ accountId: 'acc_1' }))
    expect(res.status).toBe(200)
    const queue = getPostQueue()
    expect(queue.add).toHaveBeenCalledWith(
      'generate-and-post',
      expect.objectContaining({ userId: 'user_1', accountId: 'acc_1' }),
      expect.any(Object),
    )
  })

  it('skips credit reservation for lifetimeFree users', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      aiCreditsUsed: 0,
      aiCreditsTotal: 0,
      lifetimeFree: true,
    })
    const res = await POST(makeReq({ accountId: 'acc_1' }))
    expect(res.status).toBe(200)
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('returns 400 for missing accountId', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty accountId string', async () => {
    const res = await POST(makeReq({ accountId: '' }))
    expect(res.status).toBe(400)
  })
})
