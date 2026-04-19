import { encrypt, decrypt } from '@/lib/encryption'

const VALID_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes

beforeEach(() => {
  process.env.ENCRYPTION_KEY = VALID_KEY
})

afterEach(() => {
  delete process.env.ENCRYPTION_KEY
})

describe('encrypt / decrypt', () => {
  it('roundtrips a plain string', () => {
    const plain = 'my-secret-linkedin-token'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('produces different ciphertexts for the same input (random IV)', () => {
    const plain = 'same-input'
    expect(encrypt(plain)).not.toBe(encrypt(plain))
  })

  it('output has three colon-separated base64 segments', () => {
    const parts = encrypt('hello').split(':')
    expect(parts).toHaveLength(3)
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0))
  })

  it('throws on missing ENCRYPTION_KEY', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('x')).toThrow('ENCRYPTION_KEY')
  })

  it('throws on short ENCRYPTION_KEY', () => {
    process.env.ENCRYPTION_KEY = 'short'
    expect(() => encrypt('x')).toThrow('ENCRYPTION_KEY')
  })

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const ct = encrypt('hello world')
    const [iv, tag, data] = ct.split(':')
    const tampered = `${iv}:${tag}:${Buffer.from('tampered').toString('base64')}`
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws on malformed ciphertext (missing segments)', () => {
    expect(() => decrypt('only-one-part')).toThrow('Invalid ciphertext format')
  })

  it('roundtrips unicode content', () => {
    const plain = '你好世界 🌏 LinkedIn'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('roundtrips a long token (512 chars)', () => {
    const plain = 'x'.repeat(512)
    expect(decrypt(encrypt(plain))).toBe(plain)
  })
})
