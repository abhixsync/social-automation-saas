import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { postToLinkedIn } from '@/lib/linkedin'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Load post and verify ownership + status
  const post = await prisma.post.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  if (post.status !== 'pending_approval') {
    return NextResponse.json(
      { error: 'Post must be in pending_approval status to approve' },
      { status: 400 },
    )
  }

  // Load LinkedIn account and verify active + not expired
  const account = await prisma.linkedInAccount.findFirst({
    where: { id: post.linkedInAccountId, userId: session.user.id, isActive: true },
  })

  if (!account) {
    return NextResponse.json({ error: 'LinkedIn account not found or inactive' }, { status: 404 })
  }

  if (account.expiresAt < new Date()) {
    return NextResponse.json({ error: 'LinkedIn token has expired. Please reconnect.' }, { status: 400 })
  }

  try {
    await postToLinkedIn(account.accessTokenEncrypted, account.sub, post.generatedContent)

    const updated = await prisma.post.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
    })

    return NextResponse.json({ post: updated })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    await prisma.post.update({
      where: { id },
      data: { status: 'failed', errorMessage },
    })

    console.error('[posts/approve]', err)
    return NextResponse.json({ error: 'Failed to post to LinkedIn', details: errorMessage }, { status: 502 })
  }
}
