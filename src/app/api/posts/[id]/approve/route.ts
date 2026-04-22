import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'
import { postToLinkedIn, postToLinkedInWithImage, postCarouselToLinkedIn } from '@/lib/linkedin'
import { generatePostImage, type ImageStyle } from '@/lib/image-gen'
import { generateCarouselSlides } from '@/lib/carousel-gen'
import { pngsToPdf } from '@/lib/pdf'
import { fetchStockPhoto } from '@/lib/pexels'
import { IMAGE_CREDITS, CAROUSEL_CREDITS } from '@/lib/credits'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = session.user.id

  const { allowed } = await checkRateLimit(`approve:${userId}`, 10, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  // Load post + user + prefs + account in parallel
  const [post, user, prefs] = await Promise.all([
    prisma.post.findFirst({ where: { id, userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, plan: true, name: true, lifetimeFree: true, aiCreditsTotal: true, aiCreditsUsed: true },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: { imageStyle: true, niche: true, brandColor: true, showProfilePicOnCard: true, carouselMode: true },
    }),
  ])

  if (!post || !user) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  if (post.status !== 'pending_approval') {
    return NextResponse.json({ error: 'Post must be in pending_approval status to approve' }, { status: 400 })
  }

  // Atomic claim: prevent double-approve race condition (double-click, concurrent requests)
  const claimed = await prisma.post.updateMany({
    where: { id, userId, status: 'pending_approval' },
    data: { status: 'approved' },
  })
  if (claimed.count === 0) {
    return NextResponse.json({ error: 'Post is already being processed' }, { status: 409 })
  }

  const account = await prisma.linkedInAccount.findFirst({
    where: { id: post.linkedInAccountId, userId, isActive: true },
    select: { id: true, sub: true, accessTokenEncrypted: true, expiresAt: true, displayName: true, profilePicture: true },
  })

  if (!account) {
    // Revert to pending_approval so the post isn't stuck in an orphan 'approved' state
    await prisma.post.update({ where: { id }, data: { status: 'pending_approval' } })
    return NextResponse.json({ error: 'LinkedIn account not found or inactive' }, { status: 404 })
  }
  if (account.expiresAt < new Date()) {
    await prisma.post.update({ where: { id }, data: { status: 'pending_approval' } })
    return NextResponse.json({ error: 'LinkedIn token has expired. Please reconnect.' }, { status: 400 })
  }

  // Resolve which image to post (priority order):
  // 1. customImageUrl    — user-uploaded image, takes priority; credits already charged if generatedImageUrl also set
  // 2. generatedImageUrl — pre-generated at pending_approval creation time, credits already charged
  // 3. stock_photo style — fetch from stored URL or Pexels, charge credits now
  // 4. generated card    — generate now, charge credits now
  const shouldPostImage = post.includeImage
  let imageBuffer: Buffer | null = null
  let imageCreditsCost = 0
  let resolvedStockPhotoUrl: string | null = null

  // Image credits already charged at pending_approval creation time if generatedImageUrl is set.
  // If user later uploaded a custom image, that replaces the pre-generated one — but the image
  // credit slot was already paid, so we do NOT charge again regardless of which image is used.
  const imageCreditsAlreadyCharged = post.generatedImageUrl !== null

  if (shouldPostImage) {
    if (post.customImageUrl) {
      // User uploaded their own image — takes priority over pre-generated.
      let isSafeUrl = false
      try { const u = new URL(post.customImageUrl); isSafeUrl = u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com') } catch { /* invalid */ }
      try {
        if (!isSafeUrl) throw new Error('Invalid custom image URL')
        const imgRes = await fetch(post.customImageUrl)
        if (imgRes.ok) {
          imageBuffer = Buffer.from(await imgRes.arrayBuffer())
          if (imageCreditsAlreadyCharged) {
            // Credits already paid at creation — no additional charge
            imageCreditsCost = 0
          } else {
            // Atomic: check current DB credits (not stale JS snapshot) to prevent double-spend
            const creditResult: number = user.lifetimeFree ? 1 : await prisma.$executeRaw`
              UPDATE "User" SET "aiCreditsUsed" = "aiCreditsUsed" + ${IMAGE_CREDITS}
              WHERE id = ${userId} AND "aiCreditsUsed" + ${IMAGE_CREDITS} <= "aiCreditsTotal"
            `
            if (creditResult === 0) {
              imageBuffer = null
            } else {
              imageCreditsCost = user.lifetimeFree ? 0 : IMAGE_CREDITS
            }
          }
        }
      } catch (err) {
        console.warn('[posts/approve] Custom image fetch failed, posting text-only:', err)
        imageBuffer = null
      }
    } else if (post.generatedImageUrl) {
      // Image was pre-generated by the worker at pending_approval creation time.
      // Credits were already charged then — do NOT charge again.
      let isSafeUrl = false
      try { const u = new URL(post.generatedImageUrl); isSafeUrl = u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com') } catch { /* invalid */ }
      try {
        if (!isSafeUrl) throw new Error('Invalid generated image URL')
        const imgRes = await fetch(post.generatedImageUrl)
        if (imgRes.ok) {
          imageBuffer = Buffer.from(await imgRes.arrayBuffer())
          imageCreditsCost = 0 // already charged at creation time
        }
      } catch (err) {
        console.warn('[posts/approve] Pre-generated image fetch failed, posting text-only:', err)
        imageBuffer = null
      }
    } else if ((post.imageStyle ?? 'quote_card') === 'stock_photo') {
      // Stock photo from Pexels — atomic SQL is the real guard, no stale fast-path needed
      const creditResult: number = user.lifetimeFree ? 1 : await prisma.$executeRaw`
        UPDATE "User" SET "aiCreditsUsed" = "aiCreditsUsed" + ${IMAGE_CREDITS}
        WHERE id = ${userId} AND "aiCreditsUsed" + ${IMAGE_CREDITS} <= "aiCreditsTotal"
      `
      if (creditResult > 0) {
        imageCreditsCost = user.lifetimeFree ? 0 : IMAGE_CREDITS
        // Re-download from the stored URL so approve uses the same photo the user previewed
        if (post.stockPhotoUrl) {
          try {
            const imgRes = await fetch(post.stockPhotoUrl, { signal: AbortSignal.timeout(15_000) })
            if (imgRes.ok) {
              imageBuffer = Buffer.from(await imgRes.arrayBuffer())
              resolvedStockPhotoUrl = post.stockPhotoUrl
            }
          } catch { /* fall through to fresh fetch */ }
        }
        if (!imageBuffer) {
          const stockResult = await fetchStockPhoto(post.topic, prefs?.niche ?? 'tech professional')
          if (stockResult) {
            imageBuffer = stockResult.buffer
            resolvedStockPhotoUrl = stockResult.url
          } else {
            // Pexels failed — refund and fall back to text-only
            if (!user.lifetimeFree) {
              await prisma.user.updateMany({
                where: { id: userId, aiCreditsUsed: { gte: IMAGE_CREDITS } },
                data: { aiCreditsUsed: { decrement: IMAGE_CREDITS } },
              })
            }
            imageCreditsCost = 0
          }
        }
      }
    } else {
      // Generate card image — atomic SQL is the real guard, no stale fast-path needed
      const creditResult: number = user.lifetimeFree ? 1 : await prisma.$executeRaw`
        UPDATE "User" SET "aiCreditsUsed" = "aiCreditsUsed" + ${IMAGE_CREDITS}
        WHERE id = ${userId} AND "aiCreditsUsed" + ${IMAGE_CREDITS} <= "aiCreditsTotal"
      `

      if (creditResult > 0) {
        imageCreditsCost = user.lifetimeFree ? 0 : IMAGE_CREDITS
        try {
          imageBuffer = await generatePostImage({
            style: (post.imageStyle ?? 'quote_card') as ImageStyle,
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
          if (!user.lifetimeFree) {
            await prisma.user.updateMany({
              where: { id: userId, aiCreditsUsed: { gte: IMAGE_CREDITS } },
              data: { aiCreditsUsed: { decrement: IMAGE_CREDITS } },
            })
          }
          imageCreditsCost = 0
          imageBuffer = null
        }
      }
    }
  }

  try {
    // Carousel path: generate slides → PDF → LinkedIn document post
    if (post.isCarousel) {
      let carouselCost = 0
      let linkedInPosted = false

      // Atomic SQL is the real guard — no stale fast-path needed
      const creditResult: number = user.lifetimeFree ? 1 : await prisma.$executeRaw`
        UPDATE "User" SET "aiCreditsUsed" = "aiCreditsUsed" + ${CAROUSEL_CREDITS}
        WHERE id = ${userId} AND "aiCreditsUsed" + ${CAROUSEL_CREDITS} <= "aiCreditsTotal"
      `
      if (creditResult > 0) {
        carouselCost = user.lifetimeFree ? 0 : CAROUSEL_CREDITS
        try {
          const slides = await generateCarouselSlides({
            content: post.generatedContent,
            topic: post.topic,
            niche: prefs?.niche ?? 'tech professional',
            displayName: account.displayName ?? user.name ?? 'Professional',
            plan: (user.lifetimeFree ? 'pro' : user.plan) as 'free' | 'pro',
            brandColor: prefs?.brandColor ?? undefined,
          })
          const pdfBuffer = await pngsToPdf(slides)
          await postCarouselToLinkedIn(account.accessTokenEncrypted, account.sub, post.generatedContent, pdfBuffer)
          linkedInPosted = true
        } catch (carouselErr) {
          console.warn('[posts/approve] Carousel failed, refunding and falling back:', carouselErr)
          if (!user.lifetimeFree) {
            await prisma.user.updateMany({
              where: { id: userId, aiCreditsUsed: { gte: CAROUSEL_CREDITS } },
              data: { aiCreditsUsed: { decrement: CAROUSEL_CREDITS } },
            })
          }
          carouselCost = 0
        }
      }

      // Fall back to standard post if carousel wasn't posted (insufficient credits, race, or error)
      if (!linkedInPosted) {
        if (imageBuffer) {
          await postToLinkedInWithImage(account.accessTokenEncrypted, account.sub, post.generatedContent, imageBuffer)
        } else {
          await postToLinkedIn(account.accessTokenEncrypted, account.sub, post.generatedContent)
        }
      }

      const updated = await prisma.post.update({
        where: { id },
        data: {
          status: 'published',
          publishedAt: new Date(),
          creditsUsed: post.creditsUsed + imageCreditsCost + carouselCost,
          ...(resolvedStockPhotoUrl ? { stockPhotoUrl: resolvedStockPhotoUrl } : {}),
        },
      })
      return NextResponse.json({ post: updated })
    }

    // Standard path: single image or text-only
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
        imageStyle: imageBuffer ? ((post.imageStyle ?? 'quote_card') as ImageStyle) : null,
        creditsUsed: post.creditsUsed + imageCreditsCost,
        ...(resolvedStockPhotoUrl ? { stockPhotoUrl: resolvedStockPhotoUrl } : {}),
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
