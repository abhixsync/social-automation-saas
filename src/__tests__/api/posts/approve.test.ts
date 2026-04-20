import { NextRequest } from 'next/server'
import { POST } from '@/app/api/posts/[id]/approve/route'

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }) }))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    post: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn(), updateMany: jest.fn() },
    linkedInAccount: { findFirst: jest.fn() },
    userPreferences: { findUnique: jest.fn() },
    $executeRaw: jest.fn(),
  },
}))

jest.mock('@/lib/linkedin', () => ({
  postToLinkedIn: jest.fn().mockResolvedValue(undefined),
  postToLinkedInWithImage: jest.fn().mockResolvedValue(undefined),
  postCarouselToLinkedIn: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/image-gen', () => ({
  generatePostImage: jest.fn().mockResolvedValue(Buffer.from('img')),
}))

jest.mock('@/lib/carousel-gen', () => ({
  generateCarouselSlides: jest.fn().mockResolvedValue([Buffer.from('slide1')]),
}))

jest.mock('@/lib/pdf', () => ({
  pngsToPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
}))

jest.mock('@/lib/pexels', () => ({
  fetchStockPhoto: jest.fn().mockResolvedValue(Buffer.from('stockimg')),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'
import { postToLinkedIn, postToLinkedInWithImage } from '@/lib/linkedin'
import { generatePostImage } from '@/lib/image-gen'

const mockAuth = auth as jest.Mock
const mockRateLimit = checkRateLimit as jest.Mock
const mockPrisma = prisma as jest.Mocked<typeof prisma>

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 86400_000)
const PAST = new Date(Date.now() - 1000)

const basePost = {
  id: 'post_1',
  userId: 'user_1',
  linkedInAccountId: 'acc_1',
  status: 'pending_approval',
  generatedContent: 'Hello LinkedIn!',
  topic: 'Engineering',
  creditsUsed: 10,
  includeImage: false,
  isCarousel: false,
  customImageUrl: null,
}

const baseUser = {
  id: 'user_1',
  plan: 'pro',
  name: 'Alice',
  lifetimeFree: false,
  aiCreditsTotal: 1000,
  aiCreditsUsed: 10,
}

const baseAccount = {
  id: 'acc_1',
  sub: 'li_sub_1',
  accessTokenEncrypted: 'enc_token',
  expiresAt: FUTURE,
  displayName: 'Alice',
  profilePicture: null,
}

const basePrefs = {
  imageStyle: 'quote_card',
  niche: 'tech professional',
  brandColor: null,
  showProfilePicOnCard: false,
  carouselMode: false,
}

function makeReq(postId = 'post_1') {
  return new NextRequest(`http://localhost/api/posts/${postId}/approve`, { method: 'POST' })
}

function makeParams(id = 'post_1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'user_1' } })
  mockRateLimit.mockResolvedValue({ allowed: true })
  ;(mockPrisma.post.findFirst as jest.Mock).mockResolvedValue(basePost)
  ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser)
  ;(mockPrisma.userPreferences.findUnique as jest.Mock).mockResolvedValue(basePrefs)
  ;(mockPrisma.post.updateMany as jest.Mock).mockResolvedValue({ count: 1 }) // atomic claim succeeds
  ;(mockPrisma.post.update as jest.Mock).mockResolvedValue({ ...basePost, status: 'published' })
  ;(mockPrisma.linkedInAccount.findFirst as jest.Mock).mockResolvedValue(baseAccount)
  ;(mockPrisma.$executeRaw as jest.Mock).mockResolvedValue(1)
  ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
})

// ── Auth & guards ─────────────────────────────────────────────────────────────

describe('POST /api/posts/[id]/approve — guards', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(429)
  })

  it('returns 404 when post not found', async () => {
    ;(mockPrisma.post.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 400 when post is not pending_approval', async () => {
    ;(mockPrisma.post.findFirst as jest.Mock).mockResolvedValue({ ...basePost, status: 'published' })
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 409 when double-approve race — atomic claim returns 0 rows', async () => {
    ;(mockPrisma.post.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(409)
  })

  it('returns 404 and reverts status when LinkedIn account not found', async () => {
    ;(mockPrisma.linkedInAccount.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(404)
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'pending_approval' } }),
    )
  })

  it('returns 400 and reverts status when LinkedIn token expired', async () => {
    ;(mockPrisma.linkedInAccount.findFirst as jest.Mock).mockResolvedValue({ ...baseAccount, expiresAt: PAST })
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(400)
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'pending_approval' } }),
    )
  })
})

// ── Text-only post ────────────────────────────────────────────────────────────

describe('POST /api/posts/[id]/approve — text-only', () => {
  it('posts text-only and returns 200', async () => {
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(200)
    expect(postToLinkedIn).toHaveBeenCalled()
    expect(postToLinkedInWithImage).not.toHaveBeenCalled()
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'published' }) }),
    )
  })
})

// ── Image post ────────────────────────────────────────────────────────────────

describe('POST /api/posts/[id]/approve — with image', () => {
  it('generates image and posts with image when includeImage=true', async () => {
    ;(mockPrisma.post.findFirst as jest.Mock).mockResolvedValue({ ...basePost, includeImage: true })
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(200)
    expect(generatePostImage).toHaveBeenCalled()
    expect(postToLinkedInWithImage).toHaveBeenCalled()
  })

  it('falls back to text-only when image generation fails', async () => {
    ;(mockPrisma.post.findFirst as jest.Mock).mockResolvedValue({ ...basePost, includeImage: true })
    ;(generatePostImage as jest.Mock).mockRejectedValue(new Error('render error'))
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(200)
    // Falls back to text-only
    expect(postToLinkedIn).toHaveBeenCalled()
    // Image credits refunded
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { aiCreditsUsed: { decrement: expect.any(Number) } } }),
    )
  })

  it('skips image generation when user has insufficient credits (executeRaw returns 0)', async () => {
    ;(mockPrisma.post.findFirst as jest.Mock).mockResolvedValue({ ...basePost, includeImage: true })
    ;(mockPrisma.$executeRaw as jest.Mock).mockResolvedValue(0)
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(200)
    expect(generatePostImage).not.toHaveBeenCalled()
    expect(postToLinkedIn).toHaveBeenCalled()
  })
})

// ── LinkedIn failure ──────────────────────────────────────────────────────────

describe('POST /api/posts/[id]/approve — LinkedIn failure', () => {
  it('returns 502, marks post failed, refunds image credits on LinkedIn error', async () => {
    ;(mockPrisma.post.findFirst as jest.Mock).mockResolvedValue({ ...basePost, includeImage: true })
    ;(postToLinkedInWithImage as jest.Mock).mockRejectedValue(new Error('LinkedIn API down'))
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(502)
    // Post marked as failed
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    )
    // Image credits refunded
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { aiCreditsUsed: { decrement: expect.any(Number) } } }),
    )
  })

  it('returns 502 on text-only LinkedIn failure without any credit refund', async () => {
    ;(postToLinkedIn as jest.Mock).mockRejectedValue(new Error('timeout'))
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(502)
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    )
    // No image credits to refund
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
  })
})

// ── Carousel ──────────────────────────────────────────────────────────────────

describe('POST /api/posts/[id]/approve — carousel', () => {
  const carouselPost = { ...basePost, isCarousel: true }

  it('generates carousel and posts as document', async () => {
    ;(mockPrisma.post.findFirst as jest.Mock).mockResolvedValue(carouselPost)
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(200)
    const { postCarouselToLinkedIn } = jest.requireMock('@/lib/linkedin')
    expect(postCarouselToLinkedIn).toHaveBeenCalled()
  })

  it('falls back to text-only post when carousel generation fails', async () => {
    ;(mockPrisma.post.findFirst as jest.Mock).mockResolvedValue(carouselPost)
    const { generateCarouselSlides } = jest.requireMock('@/lib/carousel-gen')
    ;(generateCarouselSlides as jest.Mock).mockRejectedValue(new Error('render error'))
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(200)
    // Falls back to text-only
    expect(postToLinkedIn).toHaveBeenCalled()
    // Carousel credits refunded
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { aiCreditsUsed: { decrement: expect.any(Number) } } }),
    )
  })

  it('bypasses credit check for lifetimeFree users', async () => {
    ;(mockPrisma.post.findFirst as jest.Mock).mockResolvedValue(carouselPost)
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ ...baseUser, lifetimeFree: true })
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(200)
  })
})
