'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  Settings,
  CreditCard,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/posts', label: 'Posts', icon: FileText, exact: false },
  { href: '/dashboard/accounts', label: 'Accounts', icon: Users, exact: false },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar, exact: false },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, exact: false },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard, exact: false },
]

interface MobileNavProps {
  credits: { used: number; total: number }
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export default function MobileNav({ credits, user }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const initials = user.name
    ? user.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? 'U'

  const remaining = credits.total - credits.used
  const pct = credits.total > 0 ? Math.min(100, (credits.used / credits.total) * 100) : 0

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <span className="text-base font-semibold text-gray-900">Cadence</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex flex-col w-72 bg-white shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">C</span>
                </div>
                <span className="text-base font-semibold text-gray-900">Cadence</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive(href, exact)
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 flex-shrink-0',
                      isActive(href, exact) ? 'text-indigo-600' : 'text-gray-400',
                    )}
                  />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="px-4 py-3 border-t border-gray-100">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>AI Credits</span>
                <span>{remaining} / {credits.total} left</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-gray-900">{user.name ?? 'Account'}</p>
                  <p className="text-xs text-gray-500 truncate max-w-[140px]">{user.email}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  await signOut({ redirect: false })
                  window.location.href = '/auth/login'
                }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
