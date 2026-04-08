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
    _queue = new Queue('linkedin-posts', { connection: getRedis() })
  }
  return _queue
}

// ─── Cron generation ──────────────────────────────────────────────────────────

/**
 * Convert a time string ("HH:MM") from a user timezone to UTC hour/minute.
 */
function toUtcTime(timeStr: string, timezone: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(':').map(Number)
  const now = new Date()
  // Build a date that represents "today at HH:MM in the given timezone"
  const localIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
  // Parse as local timezone using Intl trick
  const utcMs =
    new Date(localIso).getTime() -
    (new Date(new Date(localIso).toLocaleString('en-US', { timeZone: timezone })).getTime() -
      new Date(new Date(localIso).toLocaleString('en-US', { timeZone: 'UTC' })).getTime())
  const utcDate = new Date(utcMs)
  return { hour: utcDate.getUTCHours(), minute: utcDate.getUTCMinutes() }
}

interface TimeSlot {
  cronExpr: string
  slotKey: string // unique key for the job scheduler
}

/**
 * Generate BullMQ cron expressions (UTC) for each time slot.
 * Returns one entry per time, so multiple schedulers handle multiple posting times.
 */
export function buildTimeSlots(
  times: string[],
  daysOfWeek: number[],
  timezone: string,
): TimeSlot[] {
  if (!times.length || !daysOfWeek.length) return []
  const days = daysOfWeek.join(',')

  return times.map((time) => {
    const { hour, minute } = toUtcTime(time, timezone)
    const cronExpr = `${minute} ${hour} * * ${days}`
    const slotKey = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`
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
  const slots = buildTimeSlots(times, daysOfWeek, timezone)

  // Remove all existing schedulers for this user+account first
  await removeUserSchedule(userId, accountId)

  // Add new schedulers
  for (const slot of slots) {
    const schedulerId = `user-${userId}-account-${accountId}-slot-${slot.slotKey}`
    await queue.upsertJobScheduler(
      schedulerId,
      { pattern: slot.cronExpr, tz: 'UTC' },
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
