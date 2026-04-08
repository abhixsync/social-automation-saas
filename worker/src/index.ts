import { createWorker } from './queues.js'
import { generateAndPost } from './jobs/generate-and-post.js'
import { checkExpiringTokens } from './jobs/check-expiring-tokens.js'

// ─── BullMQ worker ────────────────────────────────────────────────────────────

const worker = createWorker(generateAndPost)

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message)
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

// Run once on startup, then every 24 hours
runDailyChecks()
const dailyTimer = setInterval(runDailyChecks, 24 * 60 * 60 * 1000)

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received — shutting down gracefully`)
  clearInterval(dailyTimer)
  await worker.close()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

console.log('[worker] Started — listening for linkedin-posts jobs')
