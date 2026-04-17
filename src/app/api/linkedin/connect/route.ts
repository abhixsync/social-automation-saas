import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildLinkedInAuthUrl } from '@/lib/linkedin'
import { PLAN_CONFIG } from '@/types'
import { randomBytes } from 'crypto'
import type { Plan } from '@/generated/prisma/enums'

export async function GET(req: NextRequest) {
  // Optional: where to redirect after successful OAuth (must be a relative path)
  const rawReturnTo = req.nextUrl.searchParams.get('return_to')
  const returnTo = rawReturnTo?.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : null
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_APP_URL!))
  }

  try {
    // Check plan limits for max LinkedIn accounts
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        plan: true,
        linkedInAccounts: { where: { isActive: true }, select: { id: true } },
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const maxAccounts = PLAN_CONFIG[user.plan as Plan].maxAccounts
    if (user.linkedInAccounts.length >= maxAccounts) {
      const billingUrl = new URL('/dashboard/billing', process.env.NEXT_PUBLIC_APP_URL!)
      billingUrl.searchParams.set('error', 'max_accounts')
      return NextResponse.redirect(billingUrl)
    }

    // Generate CSRF state token
    const state = randomBytes(16).toString('hex')
    const authUrl = buildLinkedInAuthUrl(state)

    // Store state + optional return_to in short-lived HttpOnly cookies (10 min TTL)
    const response = NextResponse.redirect(authUrl)
    response.cookies.set('li_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    })
    if (returnTo) {
      response.cookies.set('li_return_to', returnTo, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10,
        path: '/',
      })
    }

    return response
  } catch (err) {
    console.error('[linkedin/connect]', err)
    const accountsUrl = new URL('/dashboard/accounts', process.env.NEXT_PUBLIC_APP_URL!)
    accountsUrl.searchParams.set('error', 'connect_failed')
    return NextResponse.redirect(accountsUrl)
  }
}
