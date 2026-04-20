import { getRedis } from '@/lib/scheduler'

/**
 * Atomic fixed-window rate limiter backed by Redis.
 * INCR + EXPIRE run in a single pipeline to prevent key leaking on process crash.
 * By default fails closed (blocks) if Redis is unavailable; pass { failOpen: true }
 * for non-critical paths where availability matters more than strict enforcement.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSecs: number,
  options?: { failOpen?: boolean },
): Promise<{ allowed: boolean }> {
  try {
    const redis = getRedis()
    const redisKey = `rl:${key}`

    // Atomic: INCR and EXPIRE in one round-trip via pipeline
    const results = await redis.multi().incr(redisKey).expire(redisKey, windowSecs).exec()
    const count = (results?.[0]?.[1] as number) ?? 0

    return { allowed: count <= limit }
  } catch {
    return { allowed: options?.failOpen ?? false } // fail closed by default; callers can opt in to fail-open
  }
}

/** Extract caller IP from Next.js request headers.
 * On Vercel, x-real-ip is set by the edge and cannot be spoofed by the client.
 * Falls back to the last entry in x-forwarded-for (the closest trusted proxy).
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    // Take the last IP — added by the trusted reverse proxy, not client-spoofable
    const parts = forwarded.split(',')
    return parts[parts.length - 1].trim()
  }
  return 'unknown'
}
