import type { Job } from 'bullmq'
import { prisma } from '../lib/prisma.js'
import { generatePost, pickTopic, countWords } from '../lib/ai.js'
import { postToLinkedIn } from '../lib/linkedin.js'
import { wordsToCredits } from '../lib/credits.js'
import { sendPostReadyEmail } from '../lib/email.js'

interface JobData {
  userId: string
  accountId: string
}

export async function generateAndPost(job: Job<JobData>): Promise<void> {
  const { userId, accountId } = job.data

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
      },
    }),
    prisma.linkedInAccount.findUnique({
      where: { id: accountId },
      select: { id: true, sub: true, accessTokenEncrypted: true, expiresAt: true, isActive: true },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        niche: true,
        tone: true,
        contentPillars: true,
        customPromptSuffix: true,
        approvalMode: true,
      },
    }),
    // Last 20 published/approved posts — used to avoid repeating topics
    prisma.post.findMany({
      where: {
        userId,
        status: { in: ['published', 'approved', 'pending_approval'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { topic: true, generatedContent: true },
    }),
  ])

  if (!user || !account || !account.isActive) {
    console.log(`[worker] Skipping job — user or account not found/inactive`)
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
    console.warn(`[worker] Token expired for account ${accountId}`)
    return
  }

  // 3. Check credits
  const remaining = user.aiCreditsTotal - user.aiCreditsUsed
  if (remaining <= 0) {
    console.log(`[worker] User ${userId} has no credits remaining`)
    return
  }

  // 4. Pick topic (avoid recently used pillars)
  const pillars = prefs?.contentPillars ?? []
  const recentTopics = recentPosts.map((p) => p.topic).filter(Boolean)
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
    )
    content = result.content
    wordCount = result.wordCount
    model = result.model
  } catch (err) {
    console.error(`[worker] AI generation failed:`, err)
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
      const result = await tx.user.updateMany({
        where: { id: userId, aiCreditsUsed: { lte: user.aiCreditsTotal - creditsUsed } },
        data: { aiCreditsUsed: { increment: creditsUsed } },
      })
      if (result.count === 0) return // credits exhausted by a concurrent job
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

  // 7. Post to LinkedIn
  try {
    await postToLinkedIn(account.accessTokenEncrypted, account.sub, content)

    // Atomic: post record + credit deduction with race guard
    // If credits ran out concurrently, post is still recorded (already sent) with creditsUsed=0
    await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: userId, aiCreditsUsed: { lte: user.aiCreditsTotal - creditsUsed } },
        data: { aiCreditsUsed: { increment: creditsUsed } },
      })
      const finalCredits = result.count > 0 ? creditsUsed : 0
      await tx.post.create({
        data: {
          userId,
          linkedInAccountId: accountId,
          topic,
          generatedContent: content,
          wordCount,
          creditsUsed: finalCredits,
          status: 'published',
          aiModel: model as Parameters<typeof prisma.post.create>[0]['data']['aiModel'],
          publishedAt: new Date(),
        },
      })
    })

    console.log(`[worker] ✅ Published post for user ${userId}`)
  } catch (err) {
    console.error(`[worker] LinkedIn post failed:`, err)
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
        errorMessage: err instanceof Error ? err.message : 'LinkedIn post failed',
      },
    })
  }
}
