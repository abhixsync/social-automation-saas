'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/dashboard/Header'

const TITLE_PREFIXES: [string, string][] = [
  ['/dashboard/posts', 'Posts'],
  ['/dashboard/accounts', 'LinkedIn Accounts'],
  ['/dashboard/schedule', 'Schedule'],
  ['/dashboard/settings', 'Settings'],
  ['/dashboard/billing', 'Billing'],
  ['/dashboard', 'Overview'],
]

interface DashboardHeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const pathname = usePathname()
  const title = TITLE_PREFIXES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'Dashboard'
  return <Header title={title} user={user} />
}
