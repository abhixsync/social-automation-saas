import { Queue, Worker, type Processor } from 'bullmq'
import IORedis from 'ioredis'

export const redis = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
})

export const postQueue = new Queue('linkedin-posts', { connection: redis })

export function createWorker(processor: Processor) {
  return new Worker('linkedin-posts', processor, {
    connection: redis,
    concurrency: 5,
  })
}
