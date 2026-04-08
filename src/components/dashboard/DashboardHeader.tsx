'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/dashboard/Header'

const TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/posts': 'Posts',
  '/dashboard/accounts': 'LinkedIn Accounts',
  '/dashboard/schedule': 'Schedule',
  '/dashboard/settings': 'Settings',
  '/dashboard/billing': 'Billing',
}

interface DashboardHeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const pathname = usePathname()
  const title = TITLES[pathname] ?? 'Dashboard'
  return <Header title={title} user={user} />
}
