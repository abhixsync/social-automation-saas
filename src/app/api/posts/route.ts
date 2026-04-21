import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') ?? undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit

  const VALID_STATUSES = new Set(['draft', 'pending_approval', 'approved', 'published', 'failed', 'skipped'])
  if (status && !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
  }

  const where = {
    userId: session.user.id,
    ...(status ? { status: status as never } : {}),
  }

  try {
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          topic: true,
          status: true,
          generatedContent: true,
          wordCount: true,
          creditsUsed: true,
          aiModel: true,
          errorMessage: true,
          includeImage: true,
          isCarousel: true,
          customImageUrl: true,
          publishedAt: true,
          scheduledFor: true,
          createdAt: true,
          linkedInAccount: { select: { displayName: true, profilePicture: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

    return NextResponse.json({
      posts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('[posts/list]', err)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}
