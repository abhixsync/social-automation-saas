/**
 * Test: LinkedIn token expiry handling
 *
 * Risk: An expired LinkedIn token causes a 401 from the API. The worker and
 * approve route both check expiresAt before posting. If the check is wrong
 * (off-by-one on time comparison, wrong field, missing guard) the user sees
 * a failed post with credits already deducted.
 *
 * Scenarios covered:
 * 1. tokenExpiresAt() helper produces correct future date
 * 2. approve route returns 400 when account.expiresAt < now
 * 3. approve route proceeds when token is valid (expiresAt > now)
 * 4. approve route returns 404 when LinkedIn account not found
 *
 * Worker warning-window tests live in worker.check-expiring-tokens.test.ts
 */

// ─── Mock handles ─────────────────────────────────────────────────────────────

const mockAuth = jest.fn()
const mockCheckRateLimit = jest.fn()
const mockPostToLinkedIn = jest.fn()
const mockPostFindFirst = jest.fn()
const mockUserFindUnique = jest.fn()
const mockPrefsFindUnique = jest.fn()
const mockLinkedInFindFirst = jest.fn()
const mockPostUpdateMany = jest.fn()
const mockPostUpdate = jest.fn()

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../src/lib/auth', () => ({ auth: () => mockAuth() }))
jest.mock('../src/lib/ratelimit', () => ({
  checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a),
}))
jest.mock('../src/lib/linkedin', () => ({
  postToLinkedIn: (...a: unknown[]) => mockPostToLinkedIn(...a),
  postToLinkedInWithImage: jest.fn(),
  postCarouselToLinkedIn: jest.fn(),
  tokenExpiresAt: jest.requireActual('../src/lib/linkedin').tokenExpiresAt,
}))
jest.mock('../src/lib/image-gen', () => ({ generatePostImage: jest.fn() }))
jest.mock('../src/lib/carousel-gen', () => ({ generateCarouselSlides: jest.fn() }))
jest.mock('../src/lib/pdf', () => ({ pngsToPdf: jest.fn() }))
jest.mock('../src/lib/pexels', () => ({ fetchStockPhoto: jest.fn() }))
jest.mock('../src/lib/credits', () => ({ IMAGE_CREDITS: 5, CAROUSEL_CREDITS: 25 }))
jest.mock('../src/lib/prisma', () => ({
  prisma: {
    post: {
      findFirst: (...a: unknown[]) => mockPostFindFirst(...a),
      updateMany: (...a: unknown[]) => mockPostUpdateMany(...a),
      update: (...a: unknown[]) => mockPostUpdate(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      updateMany: jest.fn(),
    },
    userPreferences: {
      findUnique: (...a: unknown[]) => mockPrefsFindUnique(...a),
    },
    linkedInAccount: {
      findFirst: (...a: unknown[]) => mockLinkedInFindFirst(...a),
    },
    $executeRaw: jest.fn(),
  },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000)
}

const BASE_POST = {
  id: 'post_001',
  userId: 'user_001',
  status: 'pending_approval',
  linkedInAccountId: 'acc_001',
  includeImage: false,
  isCarousel: false,
  generatedContent: 'content',
  topic: 'AI',
  creditsUsed: 5,
  customImageUrl: null,
}

const BASE_USER = {
  id: 'user_001',
  plan: 'pro',
  name: 'Test User',
  lifetimeFree: false,
  aiCreditsTotal: 1000,
  aiCreditsUsed: 0,
}

// ─────────────────────────────────────────────────────────────────────────────
// tokenExpiresAt helper
// ─────────────────────────────────────────────────────────────────────────────

describe('tokenExpiresAt', () => {
  it('returns a date approximately expiresInSeconds into the future', () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64)
    const { tokenExpiresAt } = jest.requireActual('../src/lib/linkedin') as typeof import('../src/lib/linkedin')
    const before = Date.now()
    const result = tokenExpiresAt(3600)
    const after = Date.now()
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000)
    expect(result.getTime()).toBeLessThanOrEqual(after + 3600 * 1000)
  })

  it('returns a date at approximately now for zero seconds', () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64)
    const { tokenExpiresAt } = jest.requireActual('../src/lib/linkedin') as typeof import('../src/lib/linkedin')
    const before = Date.now()
    const result = tokenExpiresAt(0)
    expect(result.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.getTime()).toBeLessThanOrEqual(Date.now() + 50)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// approve route — token expiry guard
// ─────────────────────────────────────────────────────────────────────────────

describe('approve route — token expiry guard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user_001' } })
    mockCheckRateLimit.mockResolvedValue({ allowed: true })
    mockPostFindFirst.mockResolvedValue(BASE_POST)
    mockUserFindUnique.mockResolvedValue(BASE_USER)
    mockPrefsFindUnique.mockResolvedValue({
      imageStyle: 'quote_card',
      niche: 'tech professional',
      brandColor: null,
      showProfilePicOnCard: false,
      carouselMode: false,
    })
    mockPostUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('returns 400 when the LinkedIn account token is expired', async () => {
    mockLinkedInFindFirst.mockResolvedValue({
      id: 'acc_001',
      sub: 'li_sub_001',
      accessTokenEncrypted: 'enc_token',
      expiresAt: hoursAgo(1),
      displayName: 'Test User',
      profilePicture: null,
    })

    const { NextRequest } = await import('next/server')
    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const req = new NextRequest('http://localhost/api/posts/post_001/approve', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/expired/i)
  })

  it('does not return a token-expiry error when token is valid (expires in future)', async () => {
    mockLinkedInFindFirst.mockResolvedValue({
      id: 'acc_001',
      sub: 'li_sub_001',
      accessTokenEncrypted: 'enc_token',
      expiresAt: daysFromNow(30),
      displayName: 'Test User',
      profilePicture: null,
    })
    mockPostToLinkedIn.mockResolvedValue(undefined)
    mockPostUpdate.mockResolvedValue({ ...BASE_POST, status: 'published', publishedAt: new Date() })

    const { NextRequest } = await import('next/server')
    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const req = new NextRequest('http://localhost/api/posts/post_001/approve', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).not.toBe(400)
  })

  it('returns 404 when LinkedIn account is not found', async () => {
    mockLinkedInFindFirst.mockResolvedValue(null)

    const { NextRequest } = await import('next/server')
    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const req = new NextRequest('http://localhost/api/posts/post_001/approve', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(404)
  })
})
