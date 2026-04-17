import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPostQueue } from '@/lib/scheduler'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'

const schema = z.object({ accountId: z.string().min(1) })

// POST /api/posts/generate — manually queue a post generation job
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 5 manual triggers per hour per user
  const { allowed } = await checkRateLimit(`manual-generate:${session.user.id}`, 5, 3600)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many generation requests. Please wait before trying again.' },
      { status: 429 },
    )
  }

  try {
    const body = await req.json()
    const { accountId } = schema.parse(body)

    // Verify account belongs to this user and is active
    const account = await prisma.linkedInAccount.findFirst({
      where: { id: accountId, userId: session.user.id, isActive: true },
      select: { id: true, expiresAt: true },
    })
    if (!account) {
      return NextResponse.json({ error: 'LinkedIn account not found or inactive' }, { status: 404 })
    }
    if (account.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'LinkedIn token has expired. Please reconnect your account.' },
        { status: 400 },
      )
    }

    // Atomically reserve 1 credit to prevent unbounded queue flooding.
    // The worker will deduct the real cost and refund the 1-credit reservation.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { aiCreditsUsed: true, aiCreditsTotal: true, lifetimeFree: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!user.lifetimeFree) {
      const reservation = await prisma.user.updateMany({
        where: { id: session.user.id, aiCreditsUsed: { lt: user.aiCreditsTotal } },
        data: { aiCreditsUsed: { increment: 1 } },
      })
      if (reservation.count === 0) {
        return NextResponse.json(
          { error: 'No credits remaining. Please upgrade or top up.' },
          { status: 402 },
        )
      }
    }

    // Enqueue one-off generation job (same worker as scheduled posts)
    const queue = getPostQueue()
    await queue.add(
      'generate-and-post',
      { userId: session.user.id, accountId },
      { attempts: 2, backoff: { type: 'fixed', delay: 60_000 } },
    )

    return NextResponse.json({ message: 'Post queued successfully.' })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    console.error('[posts/generate]', err)
    return NextResponse.json({ error: 'Failed to queue post' }, { status: 500 })
  }
}
