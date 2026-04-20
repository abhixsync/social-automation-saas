import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePost } from '@/lib/ai'
import { wordsToCredits } from '@/types'
import { checkRateLimit } from '@/lib/ratelimit'
import type { Plan } from '@/generated/prisma/enums'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await checkRateLimit(`regenerate:${session.user.id}`, 10, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { id } = await params

  // Load post and verify ownership + status
  const post = await prisma.post.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  if (post.status !== 'pending_approval') {
    return NextResponse.json(
      { error: 'Post must be in pending_approval status to regenerate' },
      { status: 400 },
    )
  }

  // Load user + prefs
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, aiCreditsTotal: true, aiCreditsUsed: true, lifetimeFree: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const prefs = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
    select: { niche: true, tone: true, customPromptSuffix: true },
  })

  const niche = prefs?.niche ?? 'tech professional'
  const tone = prefs?.tone ?? 'professional'
  const customPromptSuffix = prefs?.customPromptSuffix ?? null

  // Early exit if clearly out of credits (non-atomic fast path — lifetimeFree users bypass)
  if (!user.lifetimeFree && user.aiCreditsTotal - user.aiCreditsUsed <= 0) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan or purchase a top-up.' },
      { status: 402 },
    )
  }

  try {
    // lifetimeFree users always get the pro model
    const effectivePlan = (user.lifetimeFree ? 'pro' : user.plan) as Plan
    const { content, wordCount, model } = await generatePost(
      post.topic,
      effectivePlan,
      niche,
      tone,
      customPromptSuffix,
    )

    const creditsUsed = wordsToCredits(wordCount)
    // Net cost: refund old generation's credits, charge new ones
    const netCost = creditsUsed - post.creditsUsed

    const updated = await prisma.$transaction(async (tx) => {
      // lifetimeFree users bypass all credit accounting
      if (!user.lifetimeFree) {
        if (netCost > 0) {
          // Atomic check + deduct using live DB columns (not stale JS snapshot)
          const result: number = await tx.$executeRaw`
            UPDATE "User" SET "aiCreditsUsed" = "aiCreditsUsed" + ${netCost}
            WHERE id = ${session.user.id} AND "aiCreditsUsed" + ${netCost} <= "aiCreditsTotal"
          `
          if (result === 0) {
            throw Object.assign(new Error('Insufficient credits'), { code: 'INSUFFICIENT_CREDITS' })
          }
        } else if (netCost < 0) {
          // Net refund — always safe to apply
          await tx.user.update({
            where: { id: session.user.id },
            data: { aiCreditsUsed: { increment: netCost } },
          })
        }
      }

      return tx.post.update({
        where: { id },
        data: { generatedContent: content, wordCount, creditsUsed, aiModel: model as never },
      })
    })

    return NextResponse.json({ post: updated })
  } catch (err) {
    if ((err as { code?: string }).code === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json(
        { error: 'Insufficient credits. Please upgrade your plan or purchase a top-up.' },
        { status: 402 },
      )
    }
    console.error('[posts/regenerate]', err)
    return NextResponse.json({ error: 'Failed to regenerate post' }, { status: 500 })
  }
}
