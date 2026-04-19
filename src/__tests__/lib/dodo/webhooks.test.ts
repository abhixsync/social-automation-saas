import crypto from 'node:crypto'
import { verifyDodoWebhook } from '@/lib/dodo/webhooks'

const SECRET_BYTES = crypto.randomBytes(32)
const SECRET_B64 = SECRET_BYTES.toString('base64')

function makeHeaders(id: string, ts: number, body: string, secret = SECRET_BYTES) {
  const signedContent = `${id}.${ts}.${body}`
  const sig = crypto.createHmac('sha256', secret).update(signedContent).digest('base64')
  return {
    'webhook-id': id,
    'webhook-timestamp': String(ts),
    'webhook-signature': `v1,${sig}`,
  }
}

beforeEach(() => {
  process.env.DODO_WEBHOOK_SECRET = SECRET_B64
})

afterEach(() => {
  delete process.env.DODO_WEBHOOK_SECRET
})

describe('verifyDodoWebhook', () => {
  const body = JSON.stringify({ type: 'subscription.active', data: { subscription_id: 'sub_1' } })
  const nowSec = () => Math.floor(Date.now() / 1000)

  it('accepts a valid signature', () => {
    const id = 'evt_123'
    const ts = nowSec()
    const event = verifyDodoWebhook(body, makeHeaders(id, ts, body))
    expect(event.type).toBe('subscription.active')
  })

  it('throws when DODO_WEBHOOK_SECRET is not set', () => {
    delete process.env.DODO_WEBHOOK_SECRET
    const ts = nowSec()
    expect(() =>
      verifyDodoWebhook(body, makeHeaders('id', ts, body)),
    ).toThrow('DODO_WEBHOOK_SECRET')
  })

  it('throws on missing webhook-id header', () => {
    const headers = makeHeaders('id', nowSec(), body)
    expect(() =>
      verifyDodoWebhook(body, { ...headers, 'webhook-id': '' }),
    ).toThrow('Missing Standard Webhooks headers')
  })

  it('throws on missing webhook-timestamp header', () => {
    const headers = makeHeaders('id', nowSec(), body)
    expect(() =>
      verifyDodoWebhook(body, { ...headers, 'webhook-timestamp': '' }),
    ).toThrow('Missing Standard Webhooks headers')
  })

  it('throws on stale timestamp (> 5 min old)', () => {
    const ts = nowSec() - 400
    expect(() =>
      verifyDodoWebhook(body, makeHeaders('id', ts, body)),
    ).toThrow('tolerance window')
  })

  it('throws on future timestamp (> 5 min ahead)', () => {
    const ts = nowSec() + 400
    expect(() =>
      verifyDodoWebhook(body, makeHeaders('id', ts, body)),
    ).toThrow('tolerance window')
  })

  it('throws on wrong signature', () => {
    const headers = makeHeaders('id', nowSec(), body)
    expect(() =>
      verifyDodoWebhook(body, { ...headers, 'webhook-signature': 'v1,invalidsignature==' }),
    ).toThrow('signature verification failed')
  })

  it('throws on body mismatch', () => {
    const ts = nowSec()
    const headers = makeHeaders('id', ts, body)
    expect(() =>
      verifyDodoWebhook('{"tampered":true}', headers),
    ).toThrow('signature verification failed')
  })

  it('accepts space-separated multi-sig header (key rotation)', () => {
    const id = 'evt_multi'
    const ts = nowSec()
    const goodHeaders = makeHeaders(id, ts, body)
    // Prepend a dummy sig from a rotated-out key
    const combined = `v1,invalidsig ${goodHeaders['webhook-signature']}`
    const event = verifyDodoWebhook(body, { ...goodHeaders, 'webhook-signature': combined })
    expect(event.type).toBe('subscription.active')
  })

  it('parses the event body and returns typed event', () => {
    const ts = nowSec()
    const event = verifyDodoWebhook(body, makeHeaders('id', ts, body))
    expect(event).toHaveProperty('data')
  })
})
