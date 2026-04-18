/**
 * Test: Webhook idempotency
 *
 * Risk: Dodo retries webhook delivery on non-200 responses. If the handler
 * is not idempotent, subscription.active can activate credits twice or
 * subscription.cancelled can downgrade an already-downgraded user again.
 *
 * Production guard: WebhookEvent.findUnique(webhookId) before processing;
 * WebhookEvent.create(webhookId) after processing.
 *
 * These tests operate at the handler logic level by mocking prisma and
 * verifyDodoWebhook, then calling the POST handler directly.
 */

import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindUnique = jest.fn()
const mockUpdateMany = jest.fn()
const mockUpdate = jest.fn()
const mockWebhookEventCreate = jest.fn()
const mockNotificationCreate = jest.fn()

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    webhookEvent: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      create: (...a: unknown[]) => mockWebhookEventCreate(...a),
    },
    user: {
      update: (...a: unknown[]) => mockUpdate(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
    notification: {
      create: (...a: unknown[]) => mockNotificationCreate(...a),
    },
    creditTopup: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}))

// Mock verifyDodoWebhook to always succeed — we're testing handler logic, not crypto
jest.mock('../src/lib/dodo/webhooks', () => ({
  verifyDodoWebhook: (_body: string) => JSON.parse(_body),
}))

jest.mock('../src/lib/credits', () => ({
  resetMonthlyCredits: jest.fn().mockResolvedValue(undefined),
  addTopupCredits: jest.fn().mockResolvedValue(undefined),
}))

// env vars required by productIdToPlan
process.env.DODO_PRODUCT_PRO = 'prd_pro_test'
process.env.DODO_WEBHOOK_SECRET = Buffer.from('test-secret').toString('base64')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEBHOOK_ID = 'wh_test_001'

function makeRequest(body: object): NextRequest {
  const raw = JSON.stringify(body)
  return new NextRequest('http://localhost/api/billing/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': WEBHOOK_ID,
      'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
      'webhook-signature': 'v1,mock-sig',
    },
    body: raw,
  })
}

function subscriptionActivePayload(subId = 'sub_001', productId = 'prd_pro_test', userId = 'user_001') {
  return {
    type: 'subscription.active',
    data: {
      subscription_id: subId,
      customer_id: 'cust_001',
      product_id: productId,
      status: 'active',
      metadata: { user_id: userId },
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('webhook handler — idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWebhookEventCreate.mockResolvedValue({})
    mockUpdate.mockResolvedValue({})
    mockUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('returns 200 and skips processing when the event was already recorded', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existing', eventId: WEBHOOK_ID })

    const { POST } = await import('../src/app/api/billing/webhook/route')
    const req = makeRequest(subscriptionActivePayload())
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ received: true })
    // Critical: user.update must NOT be called on duplicate delivery
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('processes subscription.active and records it when event is new', async () => {
    mockFindUnique.mockResolvedValue(null)

    const { POST } = await import('../src/app/api/billing/webhook/route')
    const req = makeRequest(subscriptionActivePayload())
    const res = await POST(req)

    expect(res.status).toBe(200)
    // Should update user plan to pro
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: 'pro' }) }),
    )
    // Should record event for idempotency
    expect(mockWebhookEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { eventId: WEBHOOK_ID } }),
    )
  })

  it('returns 400 when Standard Webhooks headers are missing', async () => {
    const req = new NextRequest('http://localhost/api/billing/webhook', {
      method: 'POST',
      body: JSON.stringify(subscriptionActivePayload()),
    })

    const { POST } = await import('../src/app/api/billing/webhook/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('records event even when metadata.user_id is missing (subscription.active with no userId)', async () => {
    mockFindUnique.mockResolvedValue(null)

    const payload = {
      type: 'subscription.active',
      data: { subscription_id: 'sub_001', customer_id: 'cust_001', product_id: 'prd_pro_test', status: 'active' },
    }

    const { POST } = await import('../src/app/api/billing/webhook/route')
    const req = makeRequest(payload)
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockWebhookEventCreate).toHaveBeenCalled()
  })

  it('uses webhook-id as idempotency key (not composite)', async () => {
    mockFindUnique.mockResolvedValue(null)

    const { POST } = await import('../src/app/api/billing/webhook/route')
    const req = makeRequest(subscriptionActivePayload())
    await POST(req)

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { eventId: WEBHOOK_ID } })
  })
})
