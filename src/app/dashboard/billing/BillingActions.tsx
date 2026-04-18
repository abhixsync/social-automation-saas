'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Plan } from '@/generated/prisma/enums'

interface Props {
  currentPlan: Plan
  mode?: 'default' | 'upgrade' | 'topup' | 'cancel'
  targetPlan?: Exclude<Plan, 'free'>
  userName?: string
  userEmail?: string
}

export default function BillingActions({
  currentPlan,
  mode = 'default',
  targetPlan,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade() {
    const plan = targetPlan ?? 'pro'
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout')
      window.location.href = data.checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  async function handleTopup() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/topup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start top-up')
      window.location.href = data.checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  async function handleCancel() {
    const confirmed = window.confirm(
      'Cancel your subscription? You will lose access immediately.',
    )
    if (!confirmed) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to cancel subscription')
      }
      router.push('/dashboard/billing')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (mode === 'cancel') {
    return (
      <div>
        <Button onClick={handleCancel} disabled={loading} variant="destructive" size="sm">
          {loading ? 'Processing…' : 'Cancel Subscription'}
        </Button>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  if (mode === 'topup') {
    return (
      <div>
        <Button
          onClick={handleTopup}
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white"
          size="sm"
        >
          {loading ? 'Redirecting…' : 'Buy Credits'}
        </Button>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  if (mode === 'upgrade' && targetPlan) {
    return (
      <div>
        <Button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
          size="sm"
        >
          {loading
            ? 'Redirecting…'
            : `Upgrade to ${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)}`}
        </Button>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  // Default: upgrade CTA for free plan users
  return (
    <div>
      <Button
        onClick={handleUpgrade}
        disabled={loading || currentPlan !== 'free'}
        className="bg-indigo-600 hover:bg-indigo-700"
        size="sm"
      >
        {loading ? 'Redirecting…' : 'Upgrade'}
      </Button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
