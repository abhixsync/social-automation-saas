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

  const post = await prisma.post.findFirst({
    where: { id, userId: session.user.id },
    include: {
      linkedInAccount: { select: { displayName: true, profilePicture: true } },
    },
  })

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  return NextResponse.json({ post })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const post = await prisma.post.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true },
  })

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  if (post.status === 'published') {
    return NextResponse.json({ error: 'Cannot delete a published post' }, { status: 400 })
  }

  await prisma.post.delete({ where: { id } })

  return NextResponse.json({ message: 'Post deleted' })
}
