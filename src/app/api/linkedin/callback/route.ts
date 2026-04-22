import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  exchangeCodeForToken,
  getLinkedInUserInfo,
  encryptToken,
  tokenExpiresAt,
} from '@/lib/linkedin'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { searchParams } = req.nextUrl

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // LinkedIn declined authorization
  if (error) {
    console.error('[linkedin/callback] OAuth error:', error)
    return NextResponse.redirect(`${appUrl}/dashboard/accounts?error=denied`)
  }

  // Verify CSRF state
  const storedState = req.cookies.get('li_oauth_state')?.value
  if (!state || !storedState || state !== storedState) {
    console.error('[linkedin/callback] invalid_state — param:', state, 'cookie:', storedState)
    return NextResponse.redirect(`${appUrl}/dashboard/accounts?error=invalid_state`)
  }

  if (!code) {
    console.error('[linkedin/callback] no_code — params:', Object.fromEntries(req.nextUrl.searchParams))
    return NextResponse.redirect(`${appUrl}/dashboard/accounts?error=no_code`)
  }

  const session = await auth()
  if (!session?.user?.id) {
    console.error('[linkedin/callback] no session — redirecting to login')
    return NextResponse.redirect(`${appUrl}/auth/login`)
  }

  try {
    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code)

    // Fetch LinkedIn profile (sub = person ID)
    const userInfo = await getLinkedInUserInfo(tokenData.access_token)

    // One LinkedIn sub can only ever belong to one app user — block even if the
    // other account soft-deleted it, so users cannot reuse a LinkedIn identity
    // across multiple Crescova accounts.
    const conflictingAccount = await prisma.linkedInAccount.findFirst({
      where: { sub: userInfo.sub, NOT: { userId: session.user.id } },
      select: { id: true },
    })
    if (conflictingAccount) {
      console.error('[linkedin/callback] account_claimed — sub:', userInfo.sub, 'attempted by userId:', session.user.id)
      return NextResponse.redirect(`${appUrl}/dashboard/accounts?error=account_claimed`)
    }

    // Encrypt and store the token
    const encryptedToken = encryptToken(tokenData.access_token)
    const expiresAt = tokenExpiresAt(tokenData.expires_in ?? 5184000) // 60 days default

    await prisma.linkedInAccount.upsert({
      where: {
        userId_sub: { userId: session.user.id, sub: userInfo.sub },
      },
      update: {
        accessTokenEncrypted: encryptedToken,
        expiresAt,
        displayName: userInfo.name,
        profilePicture: userInfo.picture ?? null,
        isActive: true,
        connectedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        sub: userInfo.sub,
        accessTokenEncrypted: encryptedToken,
        expiresAt,
        displayName: userInfo.name,
        profilePicture: userInfo.picture ?? null,
        isActive: true,
      },
    })

    // Redirect to return_to (from setup flow) or default accounts page
    const returnTo = req.cookies.get('li_return_to')?.value ?? null
    const redirectUrl = new URL(returnTo ?? '/dashboard/accounts', appUrl)
    redirectUrl.searchParams.set('connected', '1')
    const response = NextResponse.redirect(redirectUrl.toString())
    response.cookies.delete('li_oauth_state')
    if (returnTo) response.cookies.delete('li_return_to')
    return response
  } catch (err) {
    console.error('[linkedin/callback]', err)
    return NextResponse.redirect(`${appUrl}/dashboard/accounts?error=token_exchange`)
  }
}
