'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import Logo from '@/components/shared/Logo'
import { NAV_LINKS } from '@/lib/nav-links'

interface SidebarProps {
  credits: { used: number; total: number }
  plan?: string
}

export default function Sidebar({ credits, plan }: SidebarProps) {
  const pathname = usePathname()
  const remaining = credits.total - credits.used
  const pct = credits.total > 0 ? Math.min(100, (credits.used / credits.total) * 100) : 0

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/dashboard">
          <Logo size="sm" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
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

      {/* Credits bar */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>AI Credits</span>
          <span>
            {remaining} / {credits.total} left
          </span>
        </div>
        <Progress value={pct} className="h-1.5" />
        {pct >= 80 && (
          <p className="text-xs text-amber-600 mt-1.5">
            Running low —{' '}
            <Link href="/dashboard/billing" className="underline">
              upgrade
            </Link>
          </p>
        )}
        {plan && (
          <p className="text-xs text-gray-400 mt-2 capitalize">
            Plan: <span className="font-medium text-gray-600">{plan}</span>
          </p>
        )}
      </div>
    </aside>
  )
}
