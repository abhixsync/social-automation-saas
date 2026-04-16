import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePostImage, type ImageStyle } from '@/lib/image-gen'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = session.user.id

  const [post, user, prefs] = await Promise.all([
    prisma.post.findFirst({
      where: { id, userId },
      select: { generatedContent: true, topic: true, imageStyle: true, linkedInAccountId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, lifetimeFree: true, name: true },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: { niche: true, imageStyle: true },
    }),
  ])

  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const account = await prisma.linkedInAccount.findUnique({
    where: { id: post.linkedInAccountId },
    select: { displayName: true },
  })

  const style = (post.imageStyle ?? prefs?.imageStyle ?? 'quote_card') as ImageStyle
  const niche = prefs?.niche ?? 'tech professional'
  const displayName = account?.displayName ?? user?.name ?? 'Professional'
  const plan = (user?.lifetimeFree ? 'pro' : (user?.plan ?? 'free')) as 'free' | 'pro'

  try {
    const buffer = await generatePostImage({
      style,
      content: post.generatedContent,
      topic: post.topic,
      niche,
      displayName,
      plan,
    })
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
