import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
      select: { id: true, status: true, creditsUsed: true },
    })

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    if (post.status === 'published') {
      return NextResponse.json({ error: 'Cannot delete a published post' }, { status: 400 })
    }

    // Refund credits when deleting a pending_approval post
    if (post.status === 'pending_approval' && post.creditsUsed > 0) {
      await prisma.$transaction([
        prisma.post.delete({ where: { id } }),
        prisma.user.updateMany({
          where: { id: session.user.id, aiCreditsUsed: { gte: post.creditsUsed } },
          data: { aiCreditsUsed: { decrement: post.creditsUsed } },
        }),
      ])
    } else {
      await prisma.post.delete({ where: { id } })
    }

    return NextResponse.json({ message: 'Post deleted' })
  } catch (err) {
    console.error('[posts/delete]', err)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}
