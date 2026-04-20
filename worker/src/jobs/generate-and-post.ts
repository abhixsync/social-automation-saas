import type { Job } from 'bullmq'
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
  // Uses GREATEST to avoid going below 0 if the credit row was already adjusted.
  async function refundReservation(): Promise<void> {
    if (reservation <= 0) return
    await prisma.$executeRaw`
      UPDATE "User" SET "aiCreditsUsed" = GREATEST("aiCreditsUsed" - ${reservation}, 0)
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
    const remaining = user.aiCreditsTotal - user.aiCreditsUsed
    if (remaining <= 0) {
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

  // 6. Approval mode: save as pending_approval (atomic: post + credit deduction with race guard)
  if (prefs?.approvalMode) {
    let creditsDeducted = false
    await prisma.$transaction(async (tx) => {
      // Atomic: check current DB credits (not stale JS snapshot) to prevent double-spend.
      // lifetimeFree users bypass the credit check entirely — their aiCreditsTotal is finite in DB.
      const result: number = user.lifetimeFree ? 1 : await tx.$executeRaw`
        UPDATE "User" SET "aiCreditsUsed" = "aiCreditsUsed" + ${creditsUsed}
        WHERE id = ${userId} AND "aiCreditsUsed" + ${creditsUsed} <= "aiCreditsTotal"
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
          creditsUsed,
          status: 'pending_approval',
          aiModel: model as Parameters<typeof prisma.post.create>[0]['data']['aiModel'],
          includeImage: prefs?.autoImage ?? true,
          isCarousel: prefs?.carouselMode ?? false,
          scheduledFor: new Date(),
        },
      })
    })
    if (creditsDeducted) {
      console.log(`[worker] Post saved for approval — user ${userId}`)
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

  if (shouldPostImage) {
    if (imgStyle === 'stock_photo') {
      // Fetch stock photo from Pexels
      imageBuffer = await fetchStockPhoto(topic, niche)
      if (!imageBuffer) console.warn(`[worker] Pexels returned no photo, falling back to text-only`)
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

  // 8. Deduct credits atomically BEFORE posting to LinkedIn.
  // For manually-triggered jobs, the API route already reserved 1 credit to prevent queue flooding.
  // We subtract that reservation from the net amount so the user is charged exactly `totalCredits`.
  // lifetimeFree users bypass credit accounting entirely.
  const netCredits = Math.max(0, totalCredits - reservation)

  if (!user.lifetimeFree && netCredits > 0) {
    const creditResult: number = await prisma.$executeRaw`
      UPDATE "User" SET "aiCreditsUsed" = "aiCreditsUsed" + ${netCredits}
      WHERE id = ${userId} AND "aiCreditsUsed" + ${netCredits} <= "aiCreditsTotal"
    `
    if (creditResult === 0) {
      console.log(`[worker] User ${userId} ran out of credits (concurrent job) — aborting LinkedIn post`)
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
          errorMessage: 'Insufficient credits',
        },
      })
      return
    }
  } // end lifetimeFree / netCredits guard

  // 9. Post to LinkedIn (carousel or standard)
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

    await prisma.post.create({
      data: {
        userId,
        linkedInAccountId: accountId,
        topic,
        generatedContent: content,
        wordCount,
        creditsUsed: user.lifetimeFree ? 0 : totalCredits + carouselCost,
        status: 'published',
        aiModel: model as Parameters<typeof prisma.post.create>[0]['data']['aiModel'],
        includeImage: imageBuffer !== null,
        isCarousel: useCarousel,
        imageStyle: imageBuffer ? ((prefs?.imageStyle ?? 'quote_card') as Parameters<typeof prisma.post.create>[0]['data']['imageStyle']) : null,
        publishedAt: new Date(),
      },
    })

    console.log(`[worker] ✅ Published post for user ${userId}${useCarousel ? ' (carousel)' : imageBuffer ? ' (with image)' : ''}`)
  } catch (err) {
    console.error(`[worker] LinkedIn post failed:`, err)
    // Refund credits (best effort — failure here means user loses credits for a post that didn't go live)
    // Include carouselCost since it's now hoisted and accessible here
    if (!user.lifetimeFree) {
      await prisma.user.updateMany({
        where: { id: userId, aiCreditsUsed: { gte: totalCredits + carouselCost } },
        data: { aiCreditsUsed: { decrement: totalCredits + carouselCost } },
      }).catch((refundErr) => console.error('[worker] Credit refund failed:', refundErr))
    }

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
