import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resetMonthlyCredits } from '@/lib/credits'
import { checkRateLimit } from '@/lib/ratelimit'
import { isAdmin } from '@/lib/admin'
import { z } from 'zod'

const schema = z.object({
  plan: z.enum(['free', 'pro', 'on_hold']),
  subscriptionId: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { allowed } = await checkRateLimit(`admin-set-plan:${session?.user?.id}`, 10, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { userId } = await params
  const body = await req.json()
  const { plan, subscriptionId } = schema.parse(body)

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      ...(subscriptionId ? { dodoSubscriptionId: subscriptionId } : {}),
      ...(plan === 'free' ? { dodoSubscriptionId: null } : {}),
    },
  })

  if (plan === 'pro') {
    await resetMonthlyCredits(userId, 'pro')
  }

  return NextResponse.json({ ok: true })
}
