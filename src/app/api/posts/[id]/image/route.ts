import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchStockPhoto } from '@/lib/pexels'
import type { ImageStyle } from '@/lib/image-gen'
import { checkRateLimit } from '@/lib/ratelimit'

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

  const { allowed } = await checkRateLimit(`image-preview:${userId}`, 120, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

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
    // Validate URL is from Vercel Blob to prevent open redirect / SSRF
    try {
      const parsed = new URL(post.customImageUrl)
      if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.public.blob.vercel-storage.com')) {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
    }
    return NextResponse.redirect(post.customImageUrl)
  }

  const account = await prisma.linkedInAccount.findUnique({
    where: { id: post.linkedInAccountId },
    select: { displayName: true, profilePicture: true },
  })

  const style = (post.imageStyle ?? prefs?.imageStyle ?? 'quote_card') as ImageStyle
  const niche = prefs?.niche ?? 'tech professional'

  // Stock photo: fetch from Pexels directly (no edge route needed)
  if (style === 'stock_photo') {
    const buffer = await fetchStockPhoto(post.topic, niche)
    if (buffer) {
      return new Response(new Uint8Array(buffer), {
        headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
      })
    }
    // Pexels failed — fall through to generated card as fallback
  }

  const displayName = account?.displayName ?? user?.name ?? 'Professional'
  const plan = (user?.lifetimeFree ? 'pro' : (user?.plan ?? 'free')) as 'free' | 'pro'
  const brandColor = prefs?.brandColor ?? undefined
  const profilePictureUrl = account?.profilePicture ?? undefined
  const showProfilePic = prefs?.showProfilePicOnCard ?? false
  const fallbackStyle = style === 'stock_photo' ? 'quote_card' : style

  const d = encodeBase64url(JSON.stringify({ style: fallbackStyle, content: post.generatedContent, topic: post.topic, niche, displayName, plan, brandColor, profilePictureUrl, showProfilePic }))
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) {
    console.error('[image] AUTH_SECRET is not configured')
    return new Response('Server configuration error', { status: 500 })
  }
  const sig = createHash('sha256').update(d + secret).digest('hex').slice(0, 16)
  const edgeUrl = new URL(`/api/image-render?d=${d}&sig=${sig}`, req.url)
  return NextResponse.redirect(edgeUrl)
}
