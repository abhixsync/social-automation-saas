import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/register/route'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn() },
  },
}))

jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  getClientIp: jest.fn().mockReturnValue('1.2.3.4'),
}))

jest.mock('@/lib/plan-settings', () => ({
  getPlanCredits: jest.fn().mockResolvedValue(1000),
}))

jest.mock('@/lib/email', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
}))

import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockRateLimit = checkRateLimit as jest.Mock

function makeReq(body: object, country = 'US') {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-vercel-ip-country': country },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRateLimit.mockResolvedValue({ allowed: true })
  ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)
  ;(mockPrisma.user.create as jest.Mock).mockResolvedValue({ id: 'new_user' })
})

describe('POST /api/auth/register', () => {
  it('creates account and returns 201', async () => {
    const res = await POST(makeReq({ name: 'Alice', email: 'alice@example.com', password: 'password123' }))
    expect(res.status).toBe(201)
    expect(mockPrisma.user.create).toHaveBeenCalled()
  })

  it('sets currency to INR for Indian IPs', async () => {
    await POST(makeReq({ name: 'Raj', email: 'raj@example.com', password: 'password123' }, 'IN'))
    const createCall = (mockPrisma.user.create as jest.Mock).mock.calls[0][0]
    expect(createCall.data.currency).toBe('INR')
  })

  it('sets currency to USD for non-Indian IPs', async () => {
    await POST(makeReq({ name: 'Bob', email: 'bob@example.com', password: 'password123' }, 'US'))
    const createCall = (mockPrisma.user.create as jest.Mock).mock.calls[0][0]
    expect(createCall.data.currency).toBe('USD')
  })

  it('returns 409 when email already exists', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' })
    const res = await POST(makeReq({ name: 'Bob', email: 'bob@example.com', password: 'password123' }))
    expect(res.status).toBe(409)
  })

  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(makeReq({ name: 'Eve', email: 'eve@example.com', password: 'password123' }))
    expect(res.status).toBe(429)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('returns 400 for short password (< 8 chars)', async () => {
    const res = await POST(makeReq({ name: 'Alice', email: 'alice@example.com', password: 'short' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email', async () => {
    const res = await POST(makeReq({ name: 'Alice', email: 'not-an-email', password: 'password123' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for short name (< 2 chars)', async () => {
    const res = await POST(makeReq({ name: 'A', email: 'a@example.com', password: 'password123' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing fields', async () => {
    const res = await POST(makeReq({ email: 'alice@example.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 on Prisma P2002 unique violation', async () => {
    ;(mockPrisma.user.create as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    )
    const res = await POST(makeReq({ name: 'Alice', email: 'alice@example.com', password: 'password123' }))
    expect(res.status).toBe(409)
  })

  it('hashes the password (does not store plaintext)', async () => {
    await POST(makeReq({ name: 'Alice', email: 'alice@example.com', password: 'mysecretpassword' }))
    const createCall = (mockPrisma.user.create as jest.Mock).mock.calls[0][0]
    expect(createCall.data.passwordHash).toBeDefined()
    expect(createCall.data.passwordHash).not.toBe('mysecretpassword')
    expect(createCall.data).not.toHaveProperty('password')
  })
})
