import { Queue } from 'bullmq'
import IORedis from 'ioredis'

// ─── Redis connection ─────────────────────────────────────────────────────────

let _redis: IORedis | null = null

export function getRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
  }
  return _redis
}

// ─── Queue singleton ──────────────────────────────────────────────────────────

let _queue: Queue | null = null

export function getPostQueue(): Queue {
  if (!_queue) {
    _queue = new Queue('linkedin-posts', {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 }, // Keep only last 100 completed jobs
        removeOnFail: { count: 50 },      // Keep only last 50 failed jobs
      },
    })
  }
  return _queue
}

// ─── Cron generation ──────────────────────────────────────────────────────────

interface TimeSlot {
  cronExpr: string
  slotKey: string // unique key for the job scheduler
}

/**
 * Generate BullMQ cron expressions in local time for each time slot.
 * BullMQ's `tz` option handles DST automatically — no manual UTC conversion needed.
 */
export function buildTimeSlots(
  times: string[],
  daysOfWeek: number[],
): TimeSlot[] {
  if (!times.length || !daysOfWeek.length) return []
  const days = daysOfWeek.join(',')

  return times.map((time) => {
    const [h, m] = time.split(':').map(Number)
    const cronExpr = `${m} ${h} * * ${days}`
    const slotKey = `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`
    return { cronExpr, slotKey }
  })
}

// ─── Job management ───────────────────────────────────────────────────────────

export async function upsertUserSchedule(
  userId: string,
  accountId: string,
  times: string[],
  daysOfWeek: number[],
  timezone: string,
): Promise<void> {
  const queue = getPostQueue()
  const slots = buildTimeSlots(times, daysOfWeek)

  // Remove all existing schedulers for this user+account first
  await removeUserSchedule(userId, accountId)

  // Add new schedulers — pass user timezone so BullMQ handles DST automatically
  for (const slot of slots) {
    const schedulerId = `user-${userId}-account-${accountId}-slot-${slot.slotKey}`
    await queue.upsertJobScheduler(
      schedulerId,
      { pattern: slot.cronExpr, tz: timezone },
      {
        name: 'generate-and-post',
        data: { userId, accountId },
        opts: { attempts: 2, backoff: { type: 'fixed', delay: 60_000 } },
      },
    )
  }
}

export async function removeUserSchedule(userId: string, accountId: string): Promise<void> {
  const queue = getPostQueue()
  // BullMQ v5: list and remove schedulers matching our prefix
  const schedulers = await queue.getJobSchedulers()
  for (const scheduler of schedulers) {
    if (scheduler.id && scheduler.id.startsWith(`user-${userId}-account-${accountId}-`)) {
      await queue.removeJobScheduler(scheduler.id)
    }
  }
}
