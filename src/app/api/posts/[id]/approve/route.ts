import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { postToLinkedIn, postToLinkedInWithImage } from '@/lib/linkedin'
import { generatePostImage, type ImageStyle } from '@/lib/image-gen'
import { IMAGE_CREDITS } from '@/lib/credits'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = session.user.id

  // Load post + user + prefs + account in parallel
  const [post, user, prefs] = await Promise.all([
    prisma.post.findFirst({ where: { id, userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, plan: true, name: true, lifetimeFree: true, aiCreditsTotal: true, aiCreditsUsed: true },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: { imageStyle: true, niche: true, brandColor: true, showProfilePicOnCard: true },
    }),
  ])

  if (!post || !user) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  if (post.status !== 'pending_approval') {
    return NextResponse.json({ error: 'Post must be in pending_approval status to approve' }, { status: 400 })
  }

  const account = await prisma.linkedInAccount.findFirst({
    where: { id: post.linkedInAccountId, userId, isActive: true },
    select: { id: true, sub: true, accessTokenEncrypted: true, expiresAt: true, displayName: true, profilePicture: true },
  })

  if (!account) return NextResponse.json({ error: 'LinkedIn account not found or inactive' }, { status: 404 })
  if (account.expiresAt < new Date()) return NextResponse.json({ error: 'LinkedIn token has expired. Please reconnect.' }, { status: 400 })

  // Generate or fetch image if user wants it:
  // Custom upload: fetch from Vercel Blob (no generation needed)
  // Generated card: deduct credits → generate → refund on failure
  const shouldPostImage = post.includeImage
  let imageBuffer: Buffer | null = null
  let imageCreditsCost = 0

  if (shouldPostImage) {
    if (post.customImageUrl) {
      // User uploaded their own image — fetch it directly
      try {
        const imgRes = await fetch(post.customImageUrl)
        if (imgRes.ok) {
          imageBuffer = Buffer.from(await imgRes.arrayBuffer())
          imageCreditsCost = IMAGE_CREDITS
          // Deduct credits for the LinkedIn upload
          const creditResult = await prisma.user.updateMany({
            where: { id: userId, aiCreditsUsed: { lte: user.aiCreditsTotal - IMAGE_CREDITS } },
            data: { aiCreditsUsed: { increment: IMAGE_CREDITS } },
          })
          if (creditResult.count === 0) {
            imageBuffer = null
            imageCreditsCost = 0
          }
        }
      } catch (err) {
        console.warn('[posts/approve] Custom image fetch failed, posting text-only:', err)
        imageBuffer = null
      }
    } else {
      // Generate card image
      const remaining = user.aiCreditsTotal - user.aiCreditsUsed
      if (remaining >= IMAGE_CREDITS) {
        const creditResult = await prisma.user.updateMany({
          where: { id: userId, aiCreditsUsed: { lte: user.aiCreditsTotal - IMAGE_CREDITS } },
          data: { aiCreditsUsed: { increment: IMAGE_CREDITS } },
        })

        if (creditResult.count > 0) {
          imageCreditsCost = IMAGE_CREDITS
          try {
            imageBuffer = await generatePostImage({
              style: (prefs?.imageStyle ?? 'quote_card') as ImageStyle,
              content: post.generatedContent,
              topic: post.topic,
              niche: prefs?.niche ?? 'tech professional',
              displayName: account.displayName ?? user.name ?? 'Professional',
              plan: (user.lifetimeFree ? 'pro' : user.plan) as 'free' | 'pro',
              brandColor: prefs?.brandColor ?? undefined,
              profilePictureUrl: account.profilePicture ?? undefined,
              showProfilePic: prefs?.showProfilePicOnCard ?? false,
            })
          } catch (imgErr) {
            console.warn('[posts/approve] Image generation failed, refunding credits and posting text-only:', imgErr)
            await prisma.user.updateMany({
              where: { id: userId, aiCreditsUsed: { gte: IMAGE_CREDITS } },
              data: { aiCreditsUsed: { decrement: IMAGE_CREDITS } },
            })
            imageCreditsCost = 0
            imageBuffer = null
          }
        }
      }
    }
  }

  try {
    if (imageBuffer) {
      await postToLinkedInWithImage(account.accessTokenEncrypted, account.sub, post.generatedContent, imageBuffer)
    } else {
      await postToLinkedIn(account.accessTokenEncrypted, account.sub, post.generatedContent)
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        includeImage: imageBuffer !== null,
        imageStyle: imageBuffer ? (prefs?.imageStyle ?? 'quote_card') : null,
        creditsUsed: post.creditsUsed + imageCreditsCost,
      },
    })

    return NextResponse.json({ post: updated })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message.slice(0, 500) : 'Unknown error'

    // Only refund what THIS route deducted (image credits only).
    // AI generation credits (post.creditsUsed) were deducted by the worker and are non-refundable.
    await prisma.post.update({ where: { id }, data: { status: 'failed', errorMessage } })
    if (imageCreditsCost > 0) {
      await prisma.user.updateMany({
        where: { id: userId, aiCreditsUsed: { gte: imageCreditsCost } },
        data: { aiCreditsUsed: { decrement: imageCreditsCost } },
      })
    }

    console.error('[posts/approve]', err)
    return NextResponse.json({ error: 'Failed to post to LinkedIn' }, { status: 502 })
  }
}
