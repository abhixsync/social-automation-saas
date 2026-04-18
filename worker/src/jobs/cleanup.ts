import { prisma } from '../lib/prisma.js'

const DAYS = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/**
 * Prune tables that grow unboundedly:
 * - WebhookEvent: keep 30 days (well past Dodo's retry window)
 * - Post (failed/skipped): keep 90 days for user visibility, then remove
 * - Notification (read): keep 30 days
 * - Session: delete rows already past their expiry
 */
export async function runCleanup(): Promise<void> {
  const [webhooks, posts, notifs, sessions] = await Promise.all([
    prisma.webhookEvent.deleteMany({ where: { createdAt: { lt: DAYS(30) } } }),
    prisma.post.deleteMany({
      where: { status: { in: ['failed', 'skipped'] }, createdAt: { lt: DAYS(90) } },
    }),
    prisma.notification.deleteMany({
      where: { isRead: true, createdAt: { lt: DAYS(30) } },
    }),
    prisma.session.deleteMany({ where: { expires: { lt: new Date() } } }),
  ])

  console.log(
    `[worker] Cleanup done — webhooks:${webhooks.count} posts:${posts.count} notifs:${notifs.count} sessions:${sessions.count}`,
  )
}
