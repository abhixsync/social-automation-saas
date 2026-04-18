import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDbUser, getActiveLinkedInAccounts, getUserPreferences, getActiveSchedule } from '@/lib/dashboard-data'
import Sidebar from '@/components/dashboard/Sidebar'
import MobileNav from '@/components/dashboard/MobileNav'
import DashboardHeader from '@/components/dashboard/DashboardHeader'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/auth/login')
  }

  // Fetch credits + setup status — React cache() deduplicates these calls
  // if dashboard/page.tsx also calls the same functions in the same request.
  let dbUser = null
  let setupComplete = true
  try {
    const [user, accounts, prefs, activeSchedule] = await Promise.all([
      getDbUser(session.user.id),
      getActiveLinkedInAccounts(session.user.id),
      getUserPreferences(session.user.id),
      getActiveSchedule(session.user.id),
    ])
    dbUser = user
    setupComplete = accounts.length > 0 && (prefs?.contentPillars?.length ?? 0) > 0 && !!activeSchedule
  } catch {
    // DB error — sidebar will show session credits (stale but usable)
  }

  const credits = {
    used: dbUser?.aiCreditsUsed ?? session.user.aiCreditsUsed,
    total: dbUser?.aiCreditsTotal ?? session.user.aiCreditsTotal,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar credits={credits} plan={dbUser?.plan ?? session.user.plan} lifetimeFree={dbUser?.lifetimeFree ?? session.user.lifetimeFree} setupComplete={setupComplete} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden">
          <MobileNav credits={credits} lifetimeFree={dbUser?.lifetimeFree ?? session.user.lifetimeFree} user={session.user} />
        </div>

        {/* Desktop header */}
        <div className="hidden md:block">
          <DashboardHeader user={session.user} />
        </div>

        {/* Page content — Suspense enables streaming so sidebar renders immediately */}
        <main className="flex-1 overflow-y-auto">
          <Suspense>{children}</Suspense>
        </main>
      </div>
    </div>
  )
}
