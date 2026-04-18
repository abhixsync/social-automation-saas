/**
 * Test: Post approval flow — end-to-end handler logic
 *
 * Risk: The approve route coordinates auth, rate-limit, DB state machine,
 * atomic credit deduction, LinkedIn API call, and post status update in one
 * request. Any break in the chain can leave the user with:
 *   - credits deducted but post never published
 *   - post stuck in 'approved' status (can't be re-approved)
 *   - double-approve via concurrent requests
 *
 * These tests exercise the handler at the HTTP level with all external I/O
 * mocked. They verify the complete happy-path and every guarded failure branch.
 */

import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = jest.fn()
const mockCheckRateLimit = jest.fn()
const mockPostToLinkedIn = jest.fn()
const mockPostToLinkedInWithImage = jest.fn()
const mockPostCarouselToLinkedIn = jest.fn()
const mockGeneratePostImage = jest.fn()
const mockGenerateCarouselSlides = jest.fn()
const mockPngsToPdf = jest.fn()
const mockFetchStockPhoto = jest.fn()

// Prisma operation mocks — named for clarity
const mockPostFindFirst = jest.fn()
const mockUserFindUnique = jest.fn()
const mockPrefsFindUnique = jest.fn()
const mockLinkedInFindFirst = jest.fn()
const mockPostUpdateMany = jest.fn()
const mockPostUpdate = jest.fn()
const mockUserUpdateMany = jest.fn()
const mockExecuteRaw = jest.fn()

jest.mock('../src/lib/auth', () => ({ auth: () => mockAuth() }))
jest.mock('../src/lib/ratelimit', () => ({ checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a) }))
jest.mock('../src/lib/linkedin', () => ({
  postToLinkedIn: (...a: unknown[]) => mockPostToLinkedIn(...a),
  postToLinkedInWithImage: (...a: unknown[]) => mockPostToLinkedInWithImage(...a),
  postCarouselToLinkedIn: (...a: unknown[]) => mockPostCarouselToLinkedIn(...a),
}))
jest.mock('../src/lib/image-gen', () => ({ generatePostImage: (...a: unknown[]) => mockGeneratePostImage(...a) }))
jest.mock('../src/lib/carousel-gen', () => ({ generateCarouselSlides: (...a: unknown[]) => mockGenerateCarouselSlides(...a) }))
jest.mock('../src/lib/pdf', () => ({ pngsToPdf: (...a: unknown[]) => mockPngsToPdf(...a) }))
jest.mock('../src/lib/pexels', () => ({ fetchStockPhoto: (...a: unknown[]) => mockFetchStockPhoto(...a) }))
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
      updateMany: (...a: unknown[]) => mockUserUpdateMany(...a),
    },
    userPreferences: {
      findUnique: (...a: unknown[]) => mockPrefsFindUnique(...a),
    },
    linkedInAccount: {
      findFirst: (...a: unknown[]) => mockLinkedInFindFirst(...a),
    },
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
  },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_ACCOUNT = {
  id: 'acc_001',
  sub: 'li_sub_001',
  accessTokenEncrypted: 'enc_token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  displayName: 'Test User',
  profilePicture: null,
}

const VALID_USER = {
  id: 'user_001',
  plan: 'pro',
  name: 'Test User',
  lifetimeFree: false,
  aiCreditsTotal: 1000,
  aiCreditsUsed: 100,
}

const VALID_POST = {
  id: 'post_001',
  userId: 'user_001',
  status: 'pending_approval',
  linkedInAccountId: 'acc_001',
  includeImage: false,
  isCarousel: false,
  generatedContent: 'Great content about AI',
  topic: 'Artificial Intelligence',
  creditsUsed: 10,
  customImageUrl: null,
}

const VALID_PREFS = {
  imageStyle: 'quote_card',
  niche: 'tech professional',
  brandColor: null,
  showProfilePicOnCard: false,
  carouselMode: false,
}

function makeRequest(postId = 'post_001'): NextRequest {
  return new NextRequest(`http://localhost/api/posts/${postId}/approve`, { method: 'POST' })
}

function setupHappyPath() {
  mockAuth.mockResolvedValue({ user: { id: 'user_001' } })
  mockCheckRateLimit.mockResolvedValue({ allowed: true })

  // Promise.all([post, user, prefs])
  mockPostFindFirst.mockResolvedValue(VALID_POST)
  mockUserFindUnique.mockResolvedValue(VALID_USER)
  mockPrefsFindUnique.mockResolvedValue(VALID_PREFS)

  // Atomic claim: updateMany returns count=1 (success)
  mockPostUpdateMany.mockResolvedValue({ count: 1 })

  // LinkedIn account lookup
  mockLinkedInFindFirst.mockResolvedValue(VALID_ACCOUNT)

  // LinkedIn post succeeds
  mockPostToLinkedIn.mockResolvedValue(undefined)

  // Final post status update
  mockPostUpdate.mockResolvedValue({ ...VALID_POST, status: 'published', publishedAt: new Date() })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('approve route — authentication and authorization', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('returns 401 when there is no session', async () => {
    mockAuth.mockResolvedValue(null)

    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(401)
  })

  it('returns 401 when session has no user id', async () => {
    mockAuth.mockResolvedValue({ user: {} })

    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(401)
  })

  it('returns 404 when post belongs to a different user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user_002' } })
    mockCheckRateLimit.mockResolvedValue({ allowed: true })
    // findFirst with where: { id, userId } returns null for wrong user
    mockPostFindFirst.mockResolvedValue(null)
    mockUserFindUnique.mockResolvedValue({ ...VALID_USER, id: 'user_002' })
    mockPrefsFindUnique.mockResolvedValue(VALID_PREFS)

    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(404)
  })
})

describe('approve route — rate limiting', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('returns 429 when rate limit is exceeded', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user_001' } })
    mockCheckRateLimit.mockResolvedValue({ allowed: false })

    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(429)
  })
})

describe('approve route — post state machine', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('returns 400 when post is not in pending_approval status', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user_001' } })
    mockCheckRateLimit.mockResolvedValue({ allowed: true })
    mockPostFindFirst.mockResolvedValue({ ...VALID_POST, status: 'published' })
    mockUserFindUnique.mockResolvedValue(VALID_USER)
    mockPrefsFindUnique.mockResolvedValue(VALID_PREFS)

    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/pending_approval/i)
  })

  it('returns 409 when atomic claim fails (double-approve race condition)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user_001' } })
    mockCheckRateLimit.mockResolvedValue({ allowed: true })
    mockPostFindFirst.mockResolvedValue(VALID_POST)
    mockUserFindUnique.mockResolvedValue(VALID_USER)
    mockPrefsFindUnique.mockResolvedValue(VALID_PREFS)
    // count=0 means another request already claimed this post
    mockPostUpdateMany.mockResolvedValue({ count: 0 })

    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(409)
  })
})

describe('approve route — happy path (text-only post)', () => {
  beforeEach(() => { jest.clearAllMocks(); setupHappyPath() })

  it('returns 200 with the published post', async () => {
    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.post.status).toBe('published')
  })

  it('calls postToLinkedIn (not the image variant) for a text-only post', async () => {
    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(mockPostToLinkedIn).toHaveBeenCalledTimes(1)
    expect(mockPostToLinkedInWithImage).not.toHaveBeenCalled()
  })

  it('updates post status to published', async () => {
    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(mockPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'published' }) })
    )
  })
})

describe('approve route — LinkedIn API failure recovery', () => {
  beforeEach(() => { jest.clearAllMocks(); setupHappyPath() })

  it('returns 502 and marks post as failed when LinkedIn API throws', async () => {
    mockPostToLinkedIn.mockRejectedValue(new Error('LinkedIn 429: Too many requests'))
    mockPostUpdate.mockResolvedValue({ ...VALID_POST, status: 'failed' })

    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(502)
    expect(mockPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
    )
  })

  it('refunds image credits when LinkedIn API fails after image credit deduction', async () => {
    // Setup: post has image, credits were deducted
    mockPostFindFirst.mockResolvedValue({ ...VALID_POST, includeImage: true })
    mockPrefsFindUnique.mockResolvedValue({ ...VALID_PREFS, imageStyle: 'quote_card' })
    // Credit deduction for image succeeds
    mockExecuteRaw.mockResolvedValue(1)
    mockGeneratePostImage.mockResolvedValue(Buffer.from('fake-image'))
    // LinkedIn call fails AFTER image was generated
    mockPostToLinkedInWithImage.mockRejectedValue(new Error('LinkedIn 500'))
    mockPostUpdate.mockResolvedValue({ ...VALID_POST, status: 'failed' })
    mockUserUpdateMany.mockResolvedValue({ count: 1 })

    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(502)
    // Credit refund must be attempted
    expect(mockUserUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ aiCreditsUsed: { decrement: 5 } }) })
    )
  })
})

describe('approve route — image credit deduction (atomic guard)', () => {
  beforeEach(() => { jest.clearAllMocks(); setupHappyPath() })

  it('posts text-only when image credit deduction returns 0 rows (insufficient credits)', async () => {
    mockPostFindFirst.mockResolvedValue({ ...VALID_POST, includeImage: true })
    mockPrefsFindUnique.mockResolvedValue({ ...VALID_PREFS, imageStyle: 'quote_card' })
    // Atomic UPDATE returns 0: user had insufficient credits
    mockExecuteRaw.mockResolvedValue(0)
    mockPostUpdate.mockResolvedValue({ ...VALID_POST, status: 'published' })

    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(200)
    // Falls back to text-only — image variant should NOT be called
    expect(mockPostToLinkedInWithImage).not.toHaveBeenCalled()
    expect(mockPostToLinkedIn).toHaveBeenCalledTimes(1)
  })

  it('falls back to text-only and refunds credits when image generation throws', async () => {
    mockPostFindFirst.mockResolvedValue({ ...VALID_POST, includeImage: true })
    mockPrefsFindUnique.mockResolvedValue({ ...VALID_PREFS, imageStyle: 'quote_card' })
    // Credit deduction succeeds
    mockExecuteRaw.mockResolvedValue(1)
    // Image generation fails
    mockGeneratePostImage.mockRejectedValue(new Error('OOM in canvas renderer'))
    mockUserUpdateMany.mockResolvedValue({ count: 1 })
    mockPostUpdate.mockResolvedValue({ ...VALID_POST, status: 'published' })

    const { POST } = await import('../src/app/api/posts/[id]/approve/route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post_001' }) })

    expect(res.status).toBe(200)
    // Refund must have been called
    expect(mockUserUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ aiCreditsUsed: { decrement: 5 } }) })
    )
    // Falls back to text-only
    expect(mockPostToLinkedIn).toHaveBeenCalledTimes(1)
  })
})
