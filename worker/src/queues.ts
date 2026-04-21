import { Queue, Worker, type Processor } from 'bullmq'
import { Redis as IORedis } from 'ioredis'

// Upstash free tier: 500K requests/day, 256MB storage.
// With the conservative options below, BullMQ overhead is roughly:
//   stalledInterval (300s): ~288 req/day
//   lockRenewTime (60s): ~1440 req/day per active job
//   drainDelay (30ms): negligible when queue is idle
// This leaves the vast majority of the daily budget for actual app operations.
export const redis = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
})

redis.on('error', (err: Error) => {
  console.error('[redis] Connection error:', err)
})

export const postQueue = new Queue('linkedin-posts', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 100 }, // Keep only last 100 completed jobs
    removeOnFail: { count: 200 },     // Keep last 200 failed jobs for debugging
    attempts: 2,                      // Retry once on transient failures (LinkedIn 429, network errors)
    backoff: { type: 'exponential', delay: 30_000 }, // 30 s → 60 s
  },
})

export function createWorker(processor: Processor) {
  return new Worker('linkedin-posts', processor, {
    connection: redis,
    concurrency: 5,
    stalledInterval: 300_000, // Check stalled jobs every 5 min (default: 30s → saves ~2,592 req/day)
    lockDuration: 300_000,    // 5 min lock duration (covers worst-case carousel generation)
    lockRenewTime: 30_000,    // Renew lock every 30s (frequent renewal avoids expiry)
    drainDelay: 30,           // 30ms drain delay when queue is empty (default: 5ms)
  })
}
