'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface UserActionsProps {
  userId: string
  lifetimeFree: boolean
}

export default function UserActions({ userId, lifetimeFree }: UserActionsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    try {
      const method = lifetimeFree ? 'DELETE' : 'POST'
      const res = await fetch(`/api/admin/users/${userId}/lifetime-free`, { method })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Request failed')
      toast.success(lifetimeFree ? 'Lifetime Free revoked' : 'Lifetime Free granted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      variant={lifetimeFree ? 'outline' : 'default'}
      className={lifetimeFree ? 'border-red-300 text-red-600 hover:bg-red-50' : 'bg-indigo-600 hover:bg-indigo-700'}
      disabled={loading}
      onClick={toggle}
    >
      {loading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
      {lifetimeFree ? 'Revoke' : 'Grant Lifetime Free'}
    </Button>
  )
}
