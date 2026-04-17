import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ImageStyle } from '@/lib/image-gen'

function encodeBase64url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = session.user.id

  const [post, user, prefs] = await Promise.all([
    prisma.post.findFirst({
      where: { id, userId, status: 'pending_approval' },
      select: { generatedContent: true, topic: true, imageStyle: true, linkedInAccountId: true, customImageUrl: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, lifetimeFree: true, name: true },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: { niche: true, imageStyle: true, brandColor: true, showProfilePicOnCard: true },
    }),
  ])

  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Serve custom uploaded image directly (skip card generation)
  if (post.customImageUrl) {
    return NextResponse.redirect(post.customImageUrl)
  }

  const account = await prisma.linkedInAccount.findUnique({
    where: { id: post.linkedInAccountId },
    select: { displayName: true, profilePicture: true },
  })

  const style = (post.imageStyle ?? prefs?.imageStyle ?? 'quote_card') as ImageStyle
  const niche = prefs?.niche ?? 'tech professional'
  const displayName = account?.displayName ?? user?.name ?? 'Professional'
  const plan = (user?.lifetimeFree ? 'pro' : (user?.plan ?? 'free')) as 'free' | 'pro'
  const brandColor = prefs?.brandColor ?? undefined
  const profilePictureUrl = account?.profilePicture ?? undefined
  const showProfilePic = prefs?.showProfilePicOnCard ?? false

  const d = encodeBase64url(JSON.stringify({ style, content: post.generatedContent, topic: post.topic, niche, displayName, plan, brandColor, profilePictureUrl, showProfilePic }))
  const edgeUrl = new URL(`/api/image-render?d=${d}`, req.url)
  return NextResponse.redirect(edgeUrl)
}
