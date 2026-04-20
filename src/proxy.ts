// src/proxy.ts
// Kill switch + auth guard. Runs on Node.js runtime (Prisma-capable).
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { resolveAppMode, isPathLocked, MODE_CONFIG } from '@/lib/app-mode'
import type { AppMode } from '@/lib/app-mode'

// Security headers applied to every response
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https://*.public.blob.vercel-storage.com https://images.pexels.com https://media.licdn.com data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  )
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  }
  return response
}

// Module-level TTL cache — proxy cannot use unstable_cache (outside render tree)
let _cachedMode: AppMode | null = null
let _cacheExpiry = 0
const CACHE_TTL_MS = 5_000

async function resolveCurrentMode(): Promise<AppMode> {
  if (process.env.APP_MODE !== undefined) {
    return resolveAppMode({})
  }
  if (_cachedMode && Date.now() < _cacheExpiry) {
    return _cachedMode
  }
  try {
    const { prisma } = await import('@/lib/prisma')
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: ['app_mode'] } },
    })
    const settings: Record<string, string> = {}
    rows.forEach((r: { key: string; value: string }) => { settings[r.key] = r.value })
    _cachedMode = resolveAppMode(settings)
    _cacheExpiry = Date.now() + CACHE_TTL_MS
    return _cachedMode
  } catch {
    if (_cachedMode) return _cachedMode
    return 'maintenance'
  }
}

const PROTECTED_PATHS = ['/dashboard', '/billing', '/settings']
const AUTH_PATHS = ['/auth/login', '/auth/signup']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const bypassSecret = process.env.APP_MODE_BYPASS_SECRET

  // ── Step 1: Bypass URL — set cookie and redirect ─────────────────────────
  if (bypassSecret && request.nextUrl.searchParams.get('bypass') === bypassSecret) {
    const redirectUrl = new URL(pathname, request.url)
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.set('app_mode_bypass', bypassSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    })
    return addSecurityHeaders(response)
  }

  // ── Step 2: Bypass cookie — skip all mode checks ──────────────────────────
  const bypassCookie = request.cookies.get('app_mode_bypass')?.value
  if (bypassSecret && bypassCookie === bypassSecret) {
    return addSecurityHeaders(NextResponse.next())
  }

  // ── Step 3: Resolve mode ──────────────────────────────────────────────────
  const mode = await resolveCurrentMode()

  if (mode !== 'active') {
    const config = MODE_CONFIG[mode]

    // ── Step 4: Soft mode — forward x-app-mode as request header ─────────
    if (config.soft) {
      const forwardedHeaders = new Headers(request.headers)
      forwardedHeaders.set('x-app-mode', mode)
      return addSecurityHeaders(NextResponse.next({ request: { headers: forwardedHeaders } }))
    }

    // ── Step 5: Always allow /maintenance, /_next, /favicon ──────────────
    if (
      pathname === '/maintenance' ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon')
    ) {
      return addSecurityHeaders(NextResponse.next())
    }

    // ── Step 6: Lock check — rewrite to /maintenance ──────────────────────
    if (isPathLocked(mode, pathname)) {
      return addSecurityHeaders(NextResponse.rewrite(new URL('/maintenance', request.url)))
    }
  }

  // ── Auth guard — validate JWT, not just cookie presence ─────────────────
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  const isAuthRoute = AUTH_PATHS.some((p) => pathname.startsWith(p))

  // next-auth v5 changed the default cookie name to authjs.session-token
  const cookieName = process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  let token = null
  try {
    token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
      cookieName,
    })
  } catch {
    // Missing secret or malformed token — treat as unauthenticated (safe default)
    token = null
  }
  const hasSession = !!token

  if (isProtected && !hasSession) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return addSecurityHeaders(NextResponse.redirect(loginUrl))
  }

  if (isAuthRoute && hasSession) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
  }

  // Redirect authenticated users away from the homepage to dashboard
  if (pathname === '/' && hasSession) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
  }

  return addSecurityHeaders(NextResponse.next())
}

