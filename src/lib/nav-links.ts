import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  Settings,
  CreditCard,
} from 'lucide-react'

export const NAV_LINKS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/posts', label: 'Posts', icon: FileText, exact: false },
  { href: '/dashboard/accounts', label: 'Accounts', icon: Users, exact: false },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar, exact: false },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, exact: false },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard, exact: false },
]
