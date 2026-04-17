import { getRedis } from '@/lib/scheduler'

/**
 * Atomic fixed-window rate limiter backed by Redis.
 * INCR + EXPIRE run in a single pipeline to prevent key leaking on process crash.
 * By default fails open (allows) if Redis is unavailable; pass { failOpen: false }
 * for security-critical paths to fail closed instead.
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
    return { allowed: options?.failOpen ?? true } // fail open or closed based on caller preference
  }
}

/** Extract caller IP from Next.js request headers. */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}
