import { createServer } from 'node:http'
import { createWorker, redis } from './queues.js'
import { generateAndPost } from './jobs/generate-and-post.js'
import { checkExpiringTokens } from './jobs/check-expiring-tokens.js'
import { prisma } from './lib/prisma.js'

// ─── BullMQ worker ────────────────────────────────────────────────────────────

const worker = createWorker(generateAndPost)

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed`)
})

worker.on('stalled', (jobId) => {
  console.warn(`[worker] Job ${jobId} stalled — lock expired before completion. Credits may have been deducted without a post being created.`)
})

worker.on('failed', async (job, err) => {
  console.error(`[worker] Job ${job?.id} failed (attempt ${job?.attemptsMade ?? '?'}):`, err.message)

  // On final failure, ensure a Post record exists so the user can see what happened.
  // This guards against the case where the job stalled/crashed after credit deduction
  // but before the Post record was created.
  const isFinalFailure = job && (job.opts.attempts ?? 1) <= job.attemptsMade
  if (isFinalFailure && job.data?.userId && job.data?.accountId) {
    try {
      const recent = await prisma.post.findFirst({
        where: {
          userId: job.data.userId,
          linkedInAccountId: job.data.accountId,
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
        select: { id: true },
      })
      if (!recent) {
        await prisma.post.create({
          data: {
            userId: job.data.userId,
            linkedInAccountId: job.data.accountId,
            topic: 'N/A',
            generatedContent: '',
            wordCount: 0,
            creditsUsed: 0,
            status: 'failed',
            aiModel: 'llama_3_3_70b',
            errorMessage: `Job failed after all retries: ${err.message.slice(0, 400)}`,
          },
        })
        console.log(`[worker] Created failed Post record for job ${job.id} (no prior record found)`)
      }
    } catch (dbErr) {
      console.error('[worker] Could not create failure record:', dbErr)
    }
  }
})

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err)
})

// ─── Daily maintenance ────────────────────────────────────────────────────────

async function runDailyChecks(): Promise<void> {
  console.log('[worker] Running daily checks…')
  try {
    await checkExpiringTokens()
  } catch (err) {
    console.error('[worker] checkExpiringTokens failed:', err)
  }
}

// Run once on startup, then schedule at next midnight to avoid drift
runDailyChecks()

function scheduleNextDailyCheck(): NodeJS.Timeout {
  const now = new Date()
  const nextMidnight = new Date(now)
  nextMidnight.setDate(now.getDate() + 1)
  nextMidnight.setHours(0, 0, 0, 0)
  const msUntilMidnight = nextMidnight.getTime() - now.getTime()
  return setTimeout(() => {
    runDailyChecks()
    scheduleNextDailyCheck()
  }, msUntilMidnight)
}

const dailyTimer = scheduleNextDailyCheck()

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received — shutting down gracefully`)
  clearTimeout(dailyTimer)
  await worker.close()
  await prisma.$disconnect()
  await redis.quit()
  healthServer.close()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ─── Health endpoint ──────────────────────────────────────────────────────────

const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT ?? '9000', 10)
const healthServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', uptime: Math.floor(process.uptime()) }))
  } else {
    res.writeHead(404)
    res.end()
  }
})
healthServer.listen(HEALTH_PORT, () => {
  console.log(`[worker] Health endpoint → http://0.0.0.0:${HEALTH_PORT}/health`)
})

console.log('[worker] Started — listening for linkedin-posts jobs')
