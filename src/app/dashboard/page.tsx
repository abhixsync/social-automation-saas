import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDbUser, getActiveLinkedInAccounts, getUserPreferences, getActiveSchedule } from '@/lib/dashboard-data'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { FileText, Zap, Users, TrendingUp, CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import RecentPostsList from './RecentPostsList'
import NotificationBanner from './NotificationBanner'


export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Page-specific queries run fresh; shared queries use React cache() so they
  // are deduplicated with the identical calls made by layout.tsx in this request.
  const [publishedThisMonth, recentPosts, totalPosts, unreadNotifications, dbUser, linkedInAccounts, preferences, activeSchedule] = await Promise.all([
    prisma.post.count({
      where: { userId, status: 'published', publishedAt: { gte: startOfMonth } },
    }),
    prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        topic: true,
        status: true,
        creditsUsed: true,
        wordCount: true,
        createdAt: true,
        generatedContent: true,
        linkedInAccount: { select: { displayName: true } },
      },
    }),
    prisma.post.count({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, message: true },
    }),
    // Shared with layout — React cache() deduplicates these (no extra DB round-trips)
    getDbUser(userId),
    getActiveLinkedInAccounts(userId),
    getUserPreferences(userId),
    getActiveSchedule(userId),
  ])

  // Onboarding steps
  const hasAccount = linkedInAccounts.length > 0
  const hasPreferences = (preferences?.contentPillars?.length ?? 0) > 0
  const hasSchedule = !!activeSchedule
  const allDone = hasAccount && hasPreferences && hasSchedule
  const setupSteps = [
    {
      done: hasAccount,
      title: 'Connect your LinkedIn account',
      description: 'Link your LinkedIn so Crescova can post on your behalf.',
      href: '/api/linkedin/connect?return_to=/dashboard',
      cta: 'Connect LinkedIn',
    },
    {
      done: hasPreferences,
      title: 'Set your content preferences',
      description: 'Tell the AI your niche, tone, and content topics.',
      href: '/dashboard/settings',
      cta: 'Set preferences',
    },
    {
      done: hasSchedule,
      title: 'Set a posting schedule',
      description: 'Choose which days and times you want posts to go out.',
      href: '/dashboard/schedule',
      cta: 'Set schedule',
    },
  ]

  const lifetimeFree = dbUser?.lifetimeFree ?? session.user.lifetimeFree
  const creditsUsed = dbUser?.aiCreditsUsed ?? session.user.aiCreditsUsed
  const creditsTotal = dbUser?.aiCreditsTotal ?? session.user.aiCreditsTotal
  const creditsRemaining = creditsTotal - creditsUsed
  const creditsPct = lifetimeFree ? 0 : (creditsTotal > 0 ? Math.min(100, (creditsUsed / creditsTotal) * 100) : 0)

  const stats = [
    {
      label: 'Published This Month',
      value: publishedThisMonth,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Credits Remaining',
      value: lifetimeFree ? '∞' : creditsRemaining,
      icon: Zap,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'LinkedIn Accounts',
      value: linkedInAccounts.length,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Total Posts',
      value: totalPosts,
      icon: FileText,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ]

  return (
    <div className="p-6 space-y-6">

      {/* In-app notifications (e.g. credit refresh) */}
      {unreadNotifications.length > 0 && (
        <NotificationBanner notifications={unreadNotifications} />
      )}

      {/* Onboarding checklist — shown until all 3 steps complete */}
      {!allDone && (
        <Card className="border-indigo-200 bg-indigo-50/40">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Get started with Crescova</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Complete these 3 steps to start auto-posting to LinkedIn.
                </p>
              </div>
              <span className="text-sm font-medium text-indigo-600 flex-shrink-0">
                {setupSteps.filter((s) => s.done).length} / 3 done
              </span>
            </div>
            <div className="space-y-3">
              {setupSteps.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 bg-white transition-opacity ${
                    step.done ? 'opacity-50' : 'border-indigo-200 shadow-sm'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-indigo-300 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {step.title}
                    </p>
                    {!step.done && (
                      <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                    )}
                  </div>
                  {!step.done && (
                    <Link
                      href={step.href}
                      className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 flex-shrink-0"
                    >
                      {step.cta} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent posts */}
        <div className="lg:col-span-2">
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Recent Posts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <RecentPostsList posts={recentPosts.map((p) => ({
                ...p,
                createdAt: p.createdAt.toISOString(),
              }))} />
            </CardContent>
          </Card>
        </div>

        {/* Credits usage */}
        <div>
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Credit Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lifetimeFree ? (
                <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 px-4 py-4 flex items-center gap-3">
                  <span className="text-3xl leading-none">∞</span>
                  <div>
                    <p className="text-sm font-semibold text-indigo-700">Lifetime Free</p>
                    <p className="text-xs text-indigo-500 mt-0.5">Unlimited credits — no limits</p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">Used</span>
                      <span className="font-medium text-gray-900">
                        {creditsUsed} / {creditsTotal}
                      </span>
                    </div>
                    <Progress value={creditsPct} className="h-2" />
                    <p className="text-xs text-gray-400 mt-1.5">{creditsRemaining} credits remaining</p>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Plan</p>
                    <Badge variant="secondary" className="capitalize bg-indigo-50 text-indigo-700 border-0">
                      {dbUser?.plan ?? session.user.plan}
                    </Badge>
                  </div>

                  {creditsRemaining < creditsTotal * 0.2 && (
                    <a
                      href="/dashboard/billing"
                      className="block text-center text-xs font-medium text-indigo-600 hover:text-indigo-800 py-2 px-3 bg-indigo-50 rounded-lg"
                    >
                      Upgrade or top up credits →
                    </a>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
