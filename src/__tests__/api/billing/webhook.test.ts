import crypto from 'node:crypto'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/billing/webhook/route'

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEvent: { create: jest.fn(), delete: jest.fn() },
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    notification: { create: jest.fn() },
    creditTopup: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/credits', () => ({
  resetMonthlyCredits: jest.fn().mockResolvedValue(undefined),
  addTopupCredits: jest.fn().mockResolvedValue(undefined),
}))

import { prisma } from '@/lib/prisma'
import { resetMonthlyCredits, addTopupCredits } from '@/lib/credits'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECRET_BYTES = crypto.randomBytes(32)
const SECRET_B64 = SECRET_BYTES.toString('base64')

process.env.DODO_WEBHOOK_SECRET = SECRET_B64
process.env.DODO_PRODUCT_PRO = 'prod_pro_123'

function makeRequest(body: object, id = `evt_${Date.now()}`) {
  const rawBody = JSON.stringify(body)
  const ts = Math.floor(Date.now() / 1000)
  const signedContent = `${id}.${ts}.${rawBody}`
  const sig = crypto.createHmac('sha256', SECRET_BYTES).update(signedContent).digest('base64')

  return new NextRequest('http://localhost/api/billing/webhook', {
    method: 'POST',
    body: rawBody,
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(ts),
      'webhook-signature': `v1,${sig}`,
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockPrisma.webhookEvent.create as jest.Mock).mockResolvedValue({})
  ;(mockPrisma.webhookEvent.delete as jest.Mock).mockResolvedValue({})
  ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user_1' })
  ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({})
  ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  ;(mockPrisma.$transaction as jest.Mock).mockResolvedValue([])
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/billing/webhook', () => {
  it('returns 400 for bad signature', async () => {
    const rawBody = JSON.stringify({ type: 'subscription.active', data: {} })
    const req = new NextRequest('http://localhost/api/billing/webhook', {
      method: 'POST',
      body: rawBody,
      headers: {
        'webhook-id': 'evt_bad',
        'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        'webhook-signature': 'v1,invalidsignature==',
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 for duplicate event (idempotency)', async () => {
    const duplicateError = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    ;(mockPrisma.webhookEvent.create as jest.Mock).mockRejectedValue(duplicateError)

    const req = makeRequest({ type: 'subscription.renewed', data: { subscription_id: 'sub_1' } })
    const res = await POST(req)
    expect(res.status).toBe(200)
    // Business logic must NOT run for a duplicate
    expect(resetMonthlyCredits).not.toHaveBeenCalled()
  })

  it('handles subscription.active — upgrades plan and resets credits', async () => {
    const req = makeRequest({
      type: 'subscription.active',
      data: {
        subscription_id: 'sub_1',
        customer_id: 'cust_1',
        product_id: 'prod_pro_123',
        status: 'active',
        metadata: { user_id: 'user_1' },
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_1' }, data: expect.objectContaining({ plan: 'pro' }) }),
    )
    expect(resetMonthlyCredits).toHaveBeenCalledWith('user_1', 'pro')
  })

  it('handles subscription.active — falls back to email lookup when no metadata user_id', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user_email' })
    const req = makeRequest({
      type: 'subscription.active',
      data: {
        subscription_id: 'sub_2',
        customer_id: 'cust_2',
        product_id: 'prod_pro_123',
        status: 'active',
        customer: { email: 'test@example.com' },
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_email' } }),
    )
  })

  it('handles subscription.renewed — resets credits', async () => {
    const req = makeRequest({
      type: 'subscription.renewed',
      data: { subscription_id: 'sub_1', customer_id: 'cust_1', product_id: 'prod_pro_123', status: 'active' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(resetMonthlyCredits).toHaveBeenCalledWith('user_1', 'pro')
  })

  it('handles subscription.plan_changed — upgrades plan AND resets credits', async () => {
    const req = makeRequest({
      type: 'subscription.plan_changed',
      data: { subscription_id: 'sub_1', customer_id: 'cust_1', product_id: 'prod_pro_123', status: 'active' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { plan: 'pro' } }),
    )
    expect(resetMonthlyCredits).toHaveBeenCalledWith('user_1', 'pro')
  })

  it('handles subscription.cancelled — downgrades to free', async () => {
    const req = makeRequest({
      type: 'subscription.cancelled',
      data: { subscription_id: 'sub_1', customer_id: 'cust_1', product_id: 'prod_pro_123', status: 'cancelled' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { plan: 'free', dodoSubscriptionId: null } }),
    )
    expect(resetMonthlyCredits).toHaveBeenCalledWith('user_1', 'free')
  })

  it('handles payment.succeeded — adds topup credits', async () => {
    const req = makeRequest({
      type: 'payment.succeeded',
      data: {
        payment_id: 'pay_1',
        amount: 499,
        currency: 'INR',
        metadata: { user_id: 'user_1', credits: '2000' },
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(addTopupCredits).toHaveBeenCalledWith('user_1', 2000)
  })

  it('returns 500 and deletes idempotency record on processing error', async () => {
    ;(mockPrisma.user.update as jest.Mock).mockRejectedValue(new Error('DB failure'))
    const req = makeRequest({
      type: 'subscription.active',
      data: {
        subscription_id: 'sub_err',
        customer_id: 'cust_err',
        product_id: 'prod_pro_123',
        status: 'active',
        metadata: { user_id: 'user_1' },
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    expect(mockPrisma.webhookEvent.delete).toHaveBeenCalled()
  })
})
