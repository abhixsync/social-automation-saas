'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertTriangle, CheckCircle, Loader2, Plus, Link2 } from 'lucide-react'

interface Account {
  id: string
  displayName: string | null
  profilePicture: string | null
  expiresAt: string
  connectedAt: string
  sub: string
}

interface AccountsClientProps {
  accounts: Account[]
  maxAccounts: number
  plan: string
  connected?: string
  error?: string
}

function getDaysUntilExpiry(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const days = getDaysUntilExpiry(expiresAt)

  if (days <= 0) {
    return (
      <Badge className="bg-red-100 text-red-700 border-0 hover:bg-red-100 gap-1">
        <AlertTriangle className="w-3 h-3" />
        Expired
      </Badge>
    )
  }
  if (days <= 3) {
    return (
      <Badge className="bg-red-100 text-red-700 border-0 hover:bg-red-100 gap-1">
        <AlertTriangle className="w-3 h-3" />
        Expires in {days}d
      </Badge>
    )
  }
  if (days <= 14) {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-0 hover:bg-amber-100 gap-1">
        <AlertTriangle className="w-3 h-3" />
        Expires in {days}d
      </Badge>
    )
  }
  return (
    <Badge className="bg-green-100 text-green-700 border-0 hover:bg-green-100 gap-1">
      <CheckCircle className="w-3 h-3" />
      Active · {days}d left
    </Badge>
  )
}

export default function AccountsClient({ accounts: initial, maxAccounts, plan, connected, error }: AccountsClientProps) {
  const [accounts, setAccounts] = useState(initial)
  const [disconnectTarget, setDisconnectTarget] = useState<Account | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const router = useRouter()

  useEffect(() => {
    if (connected === '1') toast.success('LinkedIn account connected successfully!')
    else if (error === 'denied') toast.error('LinkedIn authorization was declined.')
    else if (error === 'invalid_state') toast.error('OAuth state mismatch. Please try again.')
    else if (error === 'token_exchange') toast.error('Failed to connect LinkedIn. Please try again.')
    else if (error) toast.error('Something went wrong. Please try again.')
    // Strip query params so toast doesn't re-fire on page refresh
    if (connected || error) router.replace('/dashboard/accounts')
  }, [connected, error, router])

  const canAdd = accounts.length < maxAccounts

  async function handleConnect() {
    setConnecting(true)
    window.location.href = '/api/linkedin/connect'
  }

  async function handleDisconnect(account: Account) {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/linkedin/disconnect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to disconnect')
      toast.success(`${account.displayName ?? 'Account'} disconnected`)
      setAccounts((prev) => prev.filter((a) => a.id !== account.id))
      setDisconnectTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect account')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">LinkedIn Accounts</h2>
          <p className="text-sm text-gray-500 mt-1">
            {accounts.length} / {maxAccounts} accounts connected
            <span className="ml-2 capitalize text-gray-400">({plan} plan)</span>
          </p>
        </div>
        <Button
          onClick={handleConnect}
          disabled={connecting || !canAdd}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {connecting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Connect LinkedIn
        </Button>
      </div>

      {!canAdd && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          You've reached your plan limit of {maxAccounts} account(s).{' '}
          <a href="/dashboard/billing" className="underline font-medium">
            Upgrade to add more.
          </a>
        </div>
      )}

      {accounts.length === 0 ? (
        <Card className="border-gray-200">
          <CardContent className="py-16 text-center">
            <Link2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No LinkedIn accounts connected</p>
            <p className="text-xs text-gray-400 mt-1">
              Connect your LinkedIn account to start posting automatically.
            </p>
            <Button
              onClick={handleConnect}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700"
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Connect LinkedIn
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => {
            const days = getDaysUntilExpiry(account.expiresAt)
            return (
              <Card key={account.id} className="border-gray-200">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-11 h-11">
                        <AvatarImage src={account.profilePicture ?? undefined} />
                        <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                          {account.displayName?.[0]?.toUpperCase() ?? 'L'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {account.displayName ?? 'LinkedIn Account'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Connected{' '}
                          {new Date(account.connectedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <ExpiryBadge expiresAt={account.expiresAt} />
                      {days <= 14 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleConnect}
                          className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        >
                          Reconnect
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDisconnectTarget(account)}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs"
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!disconnectTarget} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect{' '}
              <strong>{disconnectTarget?.displayName ?? 'this account'}</strong>? Scheduled posts for
              this account will stop publishing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disconnecting}
              onClick={() => disconnectTarget && handleDisconnect(disconnectTarget)}
            >
              {disconnecting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
