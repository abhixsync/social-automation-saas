'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface Notification {
  id: string
  message: string
}

export default function NotificationBanner({
  notifications,
}: {
  notifications: Notification[]
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  async function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id))
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => null)
  }

  const visible = notifications.filter((n) => !dismissed.has(n.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-3 px-4 py-3 rounded-lg bg-indigo-50 border border-indigo-200 text-sm text-indigo-800"
        >
          <span className="flex-1">{n.message}</span>
          <button
            onClick={() => dismiss(n.id)}
            className="flex-shrink-0 text-indigo-400 hover:text-indigo-700 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
