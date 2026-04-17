import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateCarouselSlides } from '@/lib/carousel-gen'
import { checkRateLimit } from '@/lib/ratelimit'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = session.user.id

  const { allowed } = await checkRateLimit(`carousel-preview:${userId}`, 20, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const [post, user, prefs] = await Promise.all([
    prisma.post.findFirst({
      where: { id, userId, status: 'pending_approval' },
      select: { generatedContent: true, topic: true, linkedInAccountId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, lifetimeFree: true, name: true },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: { niche: true, brandColor: true },
    }),
  ])

  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const account = await prisma.linkedInAccount.findUnique({
    where: { id: post.linkedInAccountId },
    select: { displayName: true },
  })

  const plan = (user?.lifetimeFree ? 'pro' : (user?.plan ?? 'free')) as 'free' | 'pro'
  const niche = prefs?.niche ?? 'professional'
  const displayName = account?.displayName ?? user?.name ?? 'Professional'
  const brandColor = prefs?.brandColor ?? undefined

  try {
    const buffers = await generateCarouselSlides({
      content: post.generatedContent,
      topic: post.topic,
      niche,
      displayName,
      plan,
      brandColor,
    })

    const slides = buffers.map((buf) => `data:image/png;base64,${buf.toString('base64')}`)
    return NextResponse.json({ slides })
  } catch (err) {
    console.error('[carousel-preview]', err)
    return NextResponse.json({ error: 'Failed to generate slides' }, { status: 500 })
  }
}
