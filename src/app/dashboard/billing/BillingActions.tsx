'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Plan } from '@/generated/prisma/enums'

// Declare Razorpay on window for TypeScript
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}

interface RazorpayOptions {
  key: string
  subscription_id?: string
  order_id?: string
  amount?: number
  currency?: string
  name: string
  description: string
  prefill?: { name?: string; email?: string }
  theme?: { color: string }
  handler?: (response: RazorpayPaymentResponse) => void
  modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
  open(): void
}

interface RazorpayPaymentResponse {
  razorpay_payment_id: string
  razorpay_order_id?: string
  razorpay_subscription_id?: string
  razorpay_signature: string
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay'))
    document.body.appendChild(script)
  })
}

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
  userName,
  userEmail,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade() {
    const plan = targetPlan ?? 'starter'
    setLoading(true)
    setError(null)
    try {
      await loadRazorpayScript()
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout')

      const rzp = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: 'Crescova',
        description: `${plan} Plan – Monthly`,
        prefill: { name: userName, email: userEmail },
        theme: { color: '#4f46e5' },
        handler: () => {
          router.push('/dashboard/billing?success=1')
          router.refresh()
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      })
      rzp.open()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  async function handleTopup() {
    setLoading(true)
    setError(null)
    try {
      await loadRazorpayScript()
      const res = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start top-up')

      const rzp = new window.Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: data.currency,
        name: 'Crescova',
        description: '100 AI Credits Top-Up',
        prefill: { name: userName, email: userEmail },
        theme: { color: '#4f46e5' },
        handler: async (response) => {
          const verify = await fetch('/api/billing/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
              quantity: 1,
            }),
          })
          if (verify.ok) {
            router.push('/dashboard/billing?topup=1')
            router.refresh()
          } else {
            setError('Payment verification failed. Contact support.')
            setLoading(false)
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      })
      rzp.open()
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
        <Button
          onClick={handleCancel}
          disabled={loading}
          variant="destructive"
          size="sm"
        >
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
          {loading ? 'Processing…' : 'Buy Credits'}
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
          {loading ? 'Processing…' : `Upgrade to ${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)}`}
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
        disabled={loading}
        className="bg-indigo-600 hover:bg-indigo-700"
        size="sm"
      >
        {loading ? 'Processing…' : 'Upgrade'}
      </Button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
