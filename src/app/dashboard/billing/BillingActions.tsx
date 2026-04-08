'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, ExternalLink } from 'lucide-react'
import type { Plan } from '@/generated/prisma/enums'

interface BillingActionsProps {
  currentPlan: Plan
  mode?: 'default' | 'upgrade' | 'topup'
  targetPlan?: Plan
}

export default function BillingActions({
  currentPlan,
  mode = 'default',
  targetPlan,
}: BillingActionsProps) {
  const [loading, setLoading] = useState(false)

  async function handlePortal() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to open billing portal')
      window.location.href = json.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open billing portal')
      setLoading(false)
    }
  }

  async function handleUpgrade(plan: Plan) {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to start checkout')
      window.location.href = json.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout')
      setLoading(false)
    }
  }

  async function handleTopup() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/topup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to start top-up')
      window.location.href = json.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start top-up')
      setLoading(false)
    }
  }

  if (mode === 'topup') {
    return (
      <Button
        onClick={handleTopup}
        disabled={loading}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
        size="sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Buy Credits
      </Button>
    )
  }

  if (mode === 'upgrade' && targetPlan) {
    return (
      <Button
        onClick={() => handleUpgrade(targetPlan)}
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700"
        size="sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Upgrade
      </Button>
    )
  }

  // Default: show manage billing (for paid plans) or upgrade CTA (for free)
  if (currentPlan === 'free') {
    return (
      <Button
        onClick={() => handleUpgrade('starter')}
        disabled={loading}
        className="bg-indigo-600 hover:bg-indigo-700"
        size="sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Upgrade to Starter
      </Button>
    )
  }

  return (
    <Button
      onClick={handlePortal}
      disabled={loading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <ExternalLink className="w-4 h-4" />
      )}
      Manage Billing
    </Button>
  )
}
