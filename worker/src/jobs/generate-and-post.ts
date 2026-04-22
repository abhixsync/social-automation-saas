import type { Job } from 'bullmq'
import { put, del } from '@vercel/blob'
import { prisma } from '../lib/prisma.js'
import { generatePost, pickTopic, countWords } from '../lib/ai.js'
import { postToLinkedIn, postToLinkedInWithImage, postCarouselToLinkedIn } from '../lib/linkedin.js'
import { generatePostImage } from '../lib/image-gen.js'
import { generateCarouselSlides } from '../lib/carousel-gen.js'
import { pngsToPdf } from '../lib/pdf.js'
import { fetchStockPhoto } from '../lib/pexels.js'
import { wordsToCredits, IMAGE_CREDITS, CAROUSEL_CREDITS } from '../lib/credits.js'
import { sendPostReadyEmail } from '../lib/email.js'

interface JobData {
  userId: string
  accountId: string
  manualReservation?: number // credits pre-deducted by the API route to prevent queue flooding
}

export async function generateAndPost(job: Job<JobData>): Promise<void> {
  const { userId, accountId } = job.data
  const reservation = job.data.manualReservation ?? 0

  // Refund the API-route reservation on early exit (inactive account, expired token, no credits).
  // Increments aiCreditsTotal instead of decrementing aiCreditsUsed to avoid a race with monthly
  // credit resets: if the reset fires between reservation and refund, aiCreditsUsed is already 0
  // and a used-- would be a no-op (GREATEST prevents going negative), silently losing 1 credit.
  // total++ is always safe and has the same net "credits available" effect.
  async function refundReservation(): Promise<void> {
    if (reservation <= 0) return
    await prisma.$executeRaw`
      UPDATE "User" SET "aiCreditsTotal" = "aiCreditsTotal" + ${reservation}
      WHERE id = ${userId}
    `.catch((err) => console.error('[worker] Reservation refund failed:', err))
  }

  // 1. Load user + account + preferences + recent topics (for uniqueness)
  const [user, account, prefs, recentPosts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true,
        email: true,
        name: true,
        aiCreditsTotal: true,
        aiCreditsUsed: true,
        lifetimeFree: true,
      },
    }),
    prisma.linkedInAccount.findUnique({
      where: { id: accountId },
      select: { id: true, sub: true, accessTokenEncrypted: true, expiresAt: true, isActive: true, displayName: true, profilePicture: true },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        niche: true,
        tone: true,
        contentPillars: true,
        customPromptSuffix: true,
        approvalMode: true,
        imageStyle: true,
        autoImage: true,
        brandColor: true,
        showProfilePicOnCard: true,
        carouselMode: true,
        postLength: true,
      },
    }),
    // Recent posts for topic uniqueness — fetched with a placeholder take;
    // actual take is computed after user loads (plan-aware lookback)
    prisma.post.findMany({
      where: {
        userId,
        status: { in: ['published', 'approved', 'pending_approval'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // upper bound; trimmed below based on plan
      select: { topic: true },
    }),
  ])

  if (!user || !account || !account.isActive) {
    console.log(`[worker] Skipping job — user or account not found/inactive`)
    await refundReservation()
    return
  }

  // 2. Check token expiry
  if (new Date(account.expiresAt) <= new Date()) {
    await prisma.post.create({
      data: {
        userId,
        linkedInAccountId: accountId,
        topic: 'N/A',
        generatedContent: '',
        wordCount: 0,
        creditsUsed: 0,
        status: 'failed',
        aiModel: 'llama_3_3_70b',
        errorMessage: 'LinkedIn access token expired. Please reconnect your account.',
      },
    })
    await refundReservation()
    console.warn(`[worker] Token expired for account ${accountId}`)
    return
  }

  // 3. Check credits (lifetimeFree users bypass all credit limits)
  if (!user.lifetimeFree) {
    if (user.plan === 'on_hold') {
      console.log(`[worker] User ${userId} has payment on hold — skipping post generation`)
      await refundReservation()
      return
    }
    // Live DB read to narrow TOCTOU window before expensive AI call
    const liveCredits = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiCreditsTotal: true, aiCreditsUsed: true },
    })
    if (!liveCredits || liveCredits.aiCreditsTotal - liveCredits.aiCreditsUsed <= 0) {
      console.log(`[worker] User ${userId} has no credits remaining`)
      await refundReservation()
      return
    }
  }

  // 4. Pick topic (avoid recently used pillars)
  const pillars = prefs?.contentPillars ?? []
  // Plan-aware lookback: pro/lifetime free get 100 posts, free gets 20
  const lookback = (user.lifetimeFree || user.plan === 'pro') ? 100 : 20
  const recentTopics = recentPosts.slice(0, lookback).map((p) => p.topic).filter(Boolean)
  const topic = pickTopic(pillars, recentTopics)
  const niche = prefs?.niche ?? 'tech professional'
  const tone = prefs?.tone ?? 'professional'

  // 5. Generate post (pass recent topics so AI avoids repeating them)
  let content: string
  let wordCount: number
  let model: string

  try {
    const result = await generatePost(
      topic,
      user.plan as Parameters<typeof generatePost>[1],
      niche,
      tone,
      prefs?.customPromptSuffix,
      recentTopics,
      prefs?.postLength,
    )
    content = result.content
    wordCount = result.wordCount
    model = result.model
  } catch (err) {
    console.error(`[worker] AI generation failed:`, err)
    await refundReservation()
    await prisma.post.create({
      data: {
        userId,
        linkedInAccountId: accountId,
        topic,
        generatedContent: '',
        wordCount: 0,
        creditsUsed: 0,
        status: 'failed',
        aiModel: 'llama_3_3_70b',
        errorMessage: err instanceof Error ? err.message : 'AI generation failed',
      },
    })
    return
  }

  const creditsUsed = wordsToCredits(wordCount)

  // 6. Approval mode: generate image now (locked to current settings), upload to blob,
  //    then atomically deduct all credits + create pending_approval post in one transaction.
  //    This ensures the exact same image is used when the user approves and posts to LinkedIn.
  if (prefs?.approvalMode) {
    const autoImage = prefs?.autoImage ?? true
    const imgStyle = prefs?.imageStyle ?? 'quote_card'
    let pendingImageUrl: string | null = null
    let pendingStockPhotoUrl: string | null = null
    let imageCreditsCost = 0

    if (autoImage) {
      if (imgStyle === 'stock_photo') {
        const stockResult = await fetchStockPhoto(topic, niche)
        if (stockResult) {
          try {
            const blob = await put(`post-images/pending-${Date.now()}.jpg`, stockResult.buffer, {
              access: 'public',
              contentType: 'image/jpeg',
            })
            pendingImageUrl = blob.url
            pendingStockPhotoUrl = stockResult.url
            imageCreditsCost = IMAGE_CREDITS
          } catch (blobErr) {
            console.warn('[worker] Blob upload failed for pending stock photo, posting text-only:', blobErr)
          }
        }
      } else {
        try {
          const imgBuffer = await generatePostImage({
            style: imgStyle as 'quote_card' | 'stats_card' | 'topic_card' | 'minimal_light' | 'minimal_dark' | 'list_card',
            content,
            topic,
            niche,
            displayName: account.displayName ?? user.name ?? 'Professional',
            plan: (user.lifetimeFree ? 'pro' : user.plan) as 'free' | 'pro',
            brandColor: prefs?.brandColor ?? undefined,
            profilePictureUrl: account.profilePicture ?? undefined,
            showProfilePic: prefs?.showProfilePicOnCard ?? false,
          })
          const blob = await put(`post-images/pending-${Date.now()}.png`, imgBuffer, {
            access: 'public',
            contentType: 'image/png',
          })
          pendingImageUrl = blob.url
          imageCreditsCost = IMAGE_CREDITS
        } catch (imgErr) {
          console.warn('[worker] Image generation/upload failed for pending post, proceeding text-only:', imgErr)
          pendingImageUrl = null
          imageCreditsCost = 0
        }
      }
    }

    const totalCreditsToDeduct = creditsUsed + imageCreditsCost
    let creditsDeducted = false
    await prisma.$transaction(async (tx) => {
      // Atomic: check current DB credits (not stale JS snapshot) to prevent double-spend.
      // lifetimeFree users bypass the credit check entirely — their aiCreditsTotal is finite in DB.
      const result: number = user.lifetimeFree ? 1 : await tx.$executeRaw`
        UPDATE "User" SET "aiCreditsUsed" = "aiCreditsUsed" + ${totalCreditsToDeduct}
        WHERE id = ${userId} AND "aiCreditsUsed" + ${totalCreditsToDeduct} <= "aiCreditsTotal"
      `
      if (result === 0) { await refundReservation(); return } // credits exhausted by a concurrent job
      creditsDeducted = true
      await tx.post.create({
        data: {
          userId,
          linkedInAccountId: accountId,
          topic,
          generatedContent: content,
          wordCount,
          creditsUsed: totalCreditsToDeduct,
          status: 'pending_approval',
          aiModel: model as Parameters<typeof prisma.post.create>[0]['data']['aiModel'],
          includeImage: autoImage && pendingImageUrl !== null,
          isCarousel: prefs?.carouselMode ?? false,
          imageStyle: (prefs?.imageStyle ?? null) as Parameters<typeof tx.post.create>[0]['data']['imageStyle'],
          generatedImageUrl: pendingImageUrl,
          stockPhotoUrl: pendingStockPhotoUrl,
          scheduledFor: new Date(),
        },
      })
    })

    if (!creditsDeducted && pendingImageUrl) {
      // Blob was uploaded but transaction failed (credits exhausted) — clean up the orphaned blob
      del(pendingImageUrl).catch((err) => console.error('[worker] Failed to delete orphaned blob:', err))
    }

    if (creditsDeducted) {
      console.log(`[worker] Post saved for approval — user ${userId}${pendingImageUrl ? ' (with pre-generated image)' : ''}`)
      // Fire-and-forget — email failure must not fail the job
      if (user.email) {
        sendPostReadyEmail(user.email, user.name, topic).catch((err) =>
          console.error('[worker] Failed to send post-ready email:', err),
        )
      }
    } else {
      console.log(`[worker] User ${userId} ran out of credits (concurrent job prevented double-spend)`)
    }
    return
  }

  // 7. Generate image if enabled
  const shouldPostImage = prefs?.autoImage ?? true
  const imgStyle = prefs?.imageStyle ?? 'quote_card'
  let imageBuffer: Buffer | null = null
  let stockPhotoUrl: string | null = null

  if (shouldPostImage) {
    if (imgStyle === 'stock_photo') {
      // Fetch stock photo from Pexels
      const stockResult = await fetchStockPhoto(topic, niche)
      if (stockResult) {
        imageBuffer = stockResult.buffer
        stockPhotoUrl = stockResult.url
      } else {
        console.warn(`[worker] Pexels returned no photo, falling back to text-only`)
      }
    } else {
      try {
        imageBuffer = await generatePostImage({
          style: imgStyle as 'quote_card' | 'stats_card' | 'topic_card' | 'minimal_light' | 'minimal_dark' | 'list_card',
          content,
          topic,
          niche,
          displayName: account.displayName ?? user.name ?? 'Professional',
          plan: (user.lifetimeFree ? 'pro' : user.plan) as 'free' | 'pro',
          brandColor: prefs?.brandColor ?? undefined,
          profilePictureUrl: account.profilePicture ?? undefined,
          showProfilePic: prefs?.showProfilePicOnCard ?? false,
        })
      } catch (imgErr) {
        // Image generation failure is non-fatal — fall back to text-only
        console.warn(`[worker] Image generation failed, falling back to text-only:`, imgErr)
        imageBuffer = null
      }
    }
  }

  const imgCredits = IMAGE_CREDITS
  const totalCredits = creditsUsed + (imageBuffer ? imgCredits : 0)

  // 8. Compute netCredits (reservation already deducted by API route — subtract it so user pays exactly totalCredits).
  // lifetimeFree users bypass credit accounting entirely.
  // NOTE: credit deduction is intentionally deferred until AFTER LinkedIn succeeds (step 9 transaction)
  // so that a crash between deduction and Post.create cannot lose credits without a record.
  const netCredits = Math.max(0, totalCredits - reservation)

  // 9. Post to LinkedIn (carousel or standard), then atomically deduct credits + create Post record.
  let useCarousel = prefs?.carouselMode ?? false
  let carouselCost = 0
  try {
    if (useCarousel) {
      // Atomically deduct carousel credits BEFORE generation (use live DB columns, not stale JS snapshot)
      const carouselCreditResult: number = user.lifetimeFree ? 1 : await prisma.$executeRaw`
        UPDATE "User" SET "aiCreditsUsed" = "aiCreditsUsed" + ${CAROUSEL_CREDITS}
        WHERE id = ${userId} AND "aiCreditsUsed" + ${CAROUSEL_CREDITS} <= "aiCreditsTotal"
      `
      if (carouselCreditResult === 0) {
        console.warn(`[worker] Insufficient credits for carousel — falling back to standard post`)
        useCarousel = false
      } else {
        carouselCost = CAROUSEL_CREDITS
        try {
          const slides = await generateCarouselSlides({
            content,
            topic,
            niche,
            displayName: account.displayName ?? user.name ?? 'Professional',
            plan: (user.lifetimeFree ? 'pro' : user.plan) as 'free' | 'pro',
            brandColor: prefs?.brandColor ?? undefined,
            profilePictureUrl: account.profilePicture ?? undefined,
            showProfilePic: prefs?.showProfilePicOnCard ?? false,
          })
          const pdfBuffer = await pngsToPdf(slides)
          await postCarouselToLinkedIn(account.accessTokenEncrypted, account.sub, content, pdfBuffer)
        } catch (carouselErr) {
          console.warn(`[worker] Carousel generation/upload failed, refunding and falling back:`, carouselErr)
          if (!user.lifetimeFree) {
            await prisma.user.updateMany({
              where: { id: userId, aiCreditsUsed: { gte: CAROUSEL_CREDITS } },
              data: { aiCreditsUsed: { decrement: CAROUSEL_CREDITS } },
            })
          }
          carouselCost = 0
          useCarousel = false
        }
      }
    }
    if (!useCarousel && imageBuffer) {
      await postToLinkedInWithImage(account.accessTokenEncrypted, account.sub, content, imageBuffer)
    } else if (!useCarousel) {
      await postToLinkedIn(account.accessTokenEncrypted, account.sub, content)
    }

    // LinkedIn succeeded — now atomically deduct credits AND create the Post record in one transaction.
    // This eliminates the window where credits are deducted but no Post record exists (crash safety).
    const finalCreditsUsed = user.lifetimeFree ? 0 : totalCredits + carouselCost
    try {
      await prisma.$transaction(async (tx) => {
        // Deduct credits atomically (skip for lifetimeFree; also skip if netCredits is 0 after reservation)
        if (!user.lifetimeFree && netCredits > 0) {
          const creditResult: number = await tx.$executeRaw`
            UPDATE "User" SET "aiCreditsUsed" = "aiCreditsUsed" + ${netCredits}
            WHERE id = ${userId} AND "aiCreditsUsed" + ${netCredits} <= "aiCreditsTotal"
          `
          if (creditResult === 0) throw new Error('INSUFFICIENT_CREDITS')
        }
        // Create the published post record atomically with the credit deduction
        await tx.post.create({
          data: {
            userId,
            linkedInAccountId: accountId,
            topic,
            generatedContent: content,
            wordCount,
            creditsUsed: finalCreditsUsed,
            status: 'published',
            aiModel: model as Parameters<typeof prisma.post.create>[0]['data']['aiModel'],
            includeImage: imageBuffer !== null,
            isCarousel: useCarousel,
            imageStyle: imageBuffer ? ((prefs?.imageStyle ?? 'quote_card') as Parameters<typeof prisma.post.create>[0]['data']['imageStyle']) : null,
            publishedAt: new Date(),
          },
        })
      })
      console.log(`[worker] Published post for user ${userId}${useCarousel ? ' (carousel)' : imageBuffer ? ' (with image)' : ''}`)
    } catch (txErr) {
      if (txErr instanceof Error && txErr.message === 'INSUFFICIENT_CREDITS') {
        // Post already published to LinkedIn — cannot undo. Record it with creditsUsed=0 and warn.
        // Do NOT create a failed post since the content IS live on LinkedIn.
        console.warn(`[worker] Post published but credit deduction failed (insufficient credits) for user ${userId} — recording with creditsUsed=0`)
        await prisma.post.create({
          data: {
            userId,
            linkedInAccountId: accountId,
            topic,
            generatedContent: content,
            wordCount,
            creditsUsed: 0,
            status: 'published',
            aiModel: model as Parameters<typeof prisma.post.create>[0]['data']['aiModel'],
            includeImage: imageBuffer !== null,
            isCarousel: useCarousel,
            imageStyle: imageBuffer ? ((prefs?.imageStyle ?? 'quote_card') as Parameters<typeof prisma.post.create>[0]['data']['imageStyle']) : null,
            publishedAt: new Date(),
          },
        }).catch((createErr) => console.error('[worker] Failed to create post record after INSUFFICIENT_CREDITS:', createErr))
      } else {
        // Transaction failed for another reason (DB unavailable, etc.) — post IS live but record failed.
        // Refund the reservation since credit deduction was rolled back by the failed transaction.
        console.error(`[worker] Post published but post-creation transaction failed for user ${userId}:`, txErr)
        await refundReservation()
        await prisma.post.create({
          data: {
            userId,
            linkedInAccountId: accountId,
            topic,
            generatedContent: content,
            wordCount,
            creditsUsed: 0,
            status: 'failed',
            aiModel: model as Parameters<typeof prisma.post.create>[0]['data']['aiModel'],
            includeImage: false,
            errorMessage: txErr instanceof Error ? txErr.message.slice(0, 500) : 'Post-creation transaction failed',
          },
        }).catch((createErr) => console.error('[worker] Failed to create failed post record after tx error:', createErr))
      }
    }
  } catch (err) {
    // LinkedIn post itself failed — no credit deduction occurred, so no refund needed.
    // The reservation was pre-deducted by the API route; refund it since we never charged credits.
    console.error(`[worker] LinkedIn post failed:`, err)
    await refundReservation()
    await prisma.post.create({
      data: {
        userId,
        linkedInAccountId: accountId,
        topic,
        generatedContent: content,
        wordCount,
        creditsUsed: 0,
        status: 'failed',
        aiModel: model as Parameters<typeof prisma.post.create>[0]['data']['aiModel'],
        includeImage: false,
        errorMessage: err instanceof Error ? err.message.slice(0, 500) : 'LinkedIn post failed',
      },
    })
  }
}
