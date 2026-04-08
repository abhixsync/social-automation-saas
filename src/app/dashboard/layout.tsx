import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

  // Always fetch fresh credits from DB — JWT session is stale after worker updates
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { aiCreditsUsed: true, aiCreditsTotal: true },
  })

  const credits = {
    used: dbUser?.aiCreditsUsed ?? session.user.aiCreditsUsed,
    total: dbUser?.aiCreditsTotal ?? session.user.aiCreditsTotal,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar credits={credits} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden">
          <MobileNav credits={credits} user={session.user} />
        </div>

        {/* Desktop header */}
        <div className="hidden md:block">
          <DashboardHeader user={session.user} />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
