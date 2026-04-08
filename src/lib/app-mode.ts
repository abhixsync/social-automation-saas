// src/lib/app-mode.ts
// IMPORTANT: Keep this file free of server-framework imports (next/server, next/cache, prisma).
// It is imported by middleware.ts, server components, and API routes alike.

export type AppMode =
  | 'active'
  | 'maintenance'
  | 'coming_soon'
  | 'outage'
  | 'upgrading'
  | 'read_only'
  | 'degraded'

export interface ModeConfig {
  lockMarketing: boolean
  lockApp: boolean
  soft: boolean
  defaultTitle: string
  defaultSubtitle: string
  icon: string
}

export const MODE_CONFIG: Record<AppMode, ModeConfig> = {
  active: {
    lockMarketing: false,
    lockApp: false,
    soft: false,
    defaultTitle: '',
    defaultSubtitle: '',
    icon: '',
  },
  maintenance: {
    lockMarketing: true,
    lockApp: true,
    soft: false,
    defaultTitle: 'Down for maintenance',
    defaultSubtitle: "We're making improvements. Back shortly.",
    icon: '🔧',
  },
  coming_soon: {
    lockMarketing: false,
    lockApp: true,
    soft: false,
    defaultTitle: 'Coming soon',
    defaultSubtitle: "We're putting the finishing touches on something great.",
    icon: '🚀',
  },
  outage: {
    lockMarketing: true,
    lockApp: true,
    soft: false,
    defaultTitle: 'Service disruption',
    defaultSubtitle: "We're aware of the issue and working to resolve it.",
    icon: '⚡',
  },
  upgrading: {
    lockMarketing: true,
    lockApp: true,
    soft: false,
    defaultTitle: 'System upgrade in progress',
    defaultSubtitle: "We're upgrading our systems. Back soon.",
    icon: '⬆️',
  },
  read_only: {
    lockMarketing: false,
    lockApp: false,
    soft: true,
    defaultTitle: '',
    defaultSubtitle: '',
    icon: '🔒',
  },
  degraded: {
    lockMarketing: false,
    lockApp: false,
    soft: true,
    defaultTitle: '',
    defaultSubtitle: '',
    icon: '⚠️',
  },
}

const VALID_MODES = new Set<string>(Object.keys(MODE_CONFIG))

export function resolveAppMode(settings: Record<string, string>): AppMode {
  const envMode = process.env.APP_MODE
  if (envMode !== undefined) {
    return VALID_MODES.has(envMode) ? (envMode as AppMode) : 'active'
  }
  const dbMode = settings['app_mode']
  if (dbMode && VALID_MODES.has(dbMode)) return dbMode as AppMode
  return 'active'
}

// Cadence app paths
const APP_PATH_PREFIXES = ['/dashboard', '/billing', '/settings']
const AUTH_PATH_PREFIXES = ['/auth']

export function isPathLocked(mode: AppMode, pathname: string): boolean {
  if (pathname.startsWith('/maintenance')) return false
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return false

  const config = MODE_CONFIG[mode]
  if (!config || mode === 'active') return false

  const isApp = APP_PATH_PREFIXES.some((p) => pathname.startsWith(p))
  const isAuth = AUTH_PATH_PREFIXES.some((p) => pathname.startsWith(p))
  const isMarketing =
    !isApp &&
    !isAuth &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/admin')

  if (isApp || isAuth) return config.lockApp
  if (isMarketing) return config.lockMarketing
  return false
}
