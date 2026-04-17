import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { del } from '@vercel/blob'
import { z } from 'zod'
import { wordsToCredits } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const post = await prisma.post.findFirst({
      where: { id, userId: session.user.id },
      include: {
        linkedInAccount: { select: { displayName: true, profilePicture: true } },
      },
    })

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    return NextResponse.json({ post })
  } catch (err) {
    console.error('[posts/get]', err)
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const post = await prisma.post.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, status: true, customImageUrl: true },
    })

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    if (post.status === 'published') {
      return NextResponse.json({ error: 'Cannot delete a published post' }, { status: 400 })
    }

    // Clean up custom image blob if one was uploaded
    if (post.customImageUrl) {
      try { await del(post.customImageUrl) } catch { /* blob may already be gone */ }
    }

    // Credits are non-refundable on delete — AI generation already ran and consumed compute.
    await prisma.post.delete({ where: { id } })

    return NextResponse.json({ message: 'Post deleted' })
  } catch (err) {
    console.error('[posts/delete]', err)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}

const patchSchema = z.object({
  generatedContent: z.string().min(1, 'Content cannot be empty').max(5000, 'Content too long').optional(),
  includeImage: z.boolean().optional(),
}).refine(
  (data) => data.generatedContent !== undefined || data.includeImage !== undefined,
  { message: 'At least one of generatedContent or includeImage must be provided' },
)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await req.json()
    const { generatedContent, includeImage } = patchSchema.parse(body)

    const post = await prisma.post.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, status: true, creditsUsed: true },
    })

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (post.status !== 'pending_approval') {
      return NextResponse.json({ error: 'Only pending posts can be edited' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}

    if (generatedContent !== undefined) {
      const newWordCount = generatedContent.trim().split(/\s+/).filter(Boolean).length
      const newCreditsUsed = wordsToCredits(newWordCount)
      const delta = newCreditsUsed - post.creditsUsed

      updateData.generatedContent = generatedContent
      updateData.wordCount = newWordCount
      updateData.creditsUsed = newCreditsUsed

      // Adjust user credits atomically for the delta
      if (delta > 0) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { aiCreditsTotal: true, aiCreditsUsed: true },
        })
        const result = await prisma.user.updateMany({
          where: { id: session.user.id, aiCreditsUsed: { lte: (user?.aiCreditsTotal ?? 0) - delta } },
          data: { aiCreditsUsed: { increment: delta } },
        })
        if (result.count === 0) {
          return NextResponse.json({ error: 'Insufficient credits for expanded content' }, { status: 402 })
        }
      } else if (delta < 0) {
        await prisma.user.updateMany({
          where: { id: session.user.id, aiCreditsUsed: { gte: -delta } },
          data: { aiCreditsUsed: { decrement: -delta } },
        })
      }
    }

    if (includeImage !== undefined) {
      updateData.includeImage = includeImage
    }

    const updated = await prisma.post.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ post: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Validation error' }, { status: 400 })
    }
    console.error('[posts/patch]', err)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}
