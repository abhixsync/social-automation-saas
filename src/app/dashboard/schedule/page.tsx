'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, X, Save, Calendar, Zap } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

interface LinkedInAccount {
  id: string
  displayName: string | null
  profilePicture: string | null
  sub: string
}

interface Schedule {
  linkedInAccountId: string
  times: string[]
  daysOfWeek: number[]
  isActive: boolean
  linkedInAccount?: {
    displayName: string | null
    profilePicture: string | null
  }
}

interface AccountScheduleState {
  times: string[]
  daysOfWeek: number[]
  isActive: boolean
  saving: boolean
  dirty: boolean
  isNew: boolean
}

export default function SchedulePage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([])
  const [schedules, setSchedules] = useState<Record<string, AccountScheduleState>>({})
  const [loading, setLoading] = useState(true)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal

    async function load() {
      try {
        const [accsRes, schRes] = await Promise.all([
          fetch('/api/linkedin/accounts', { credentials: 'include', signal }),
          fetch('/api/schedule', { credentials: 'include', signal }),
        ])

        let accs: LinkedInAccount[] = []
        if (accsRes.ok) {
          const j = await accsRes.json()
          accs = j.accounts ?? []
        }

        let existingSchedules: Schedule[] = []
        if (schRes.ok) {
          const j = await schRes.json()
          existingSchedules = j.schedules ?? []
        }

        setAccounts(accs)

        const stateMap: Record<string, AccountScheduleState> = {}
        for (const acc of accs) {
          const existing = existingSchedules.find((s) => s.linkedInAccountId === acc.id)
          stateMap[acc.id] = {
            times: existing?.times ?? ['09:00'],
            daysOfWeek: existing?.daysOfWeek ?? [1, 2, 3, 4, 5],
            isActive: existing?.isActive ?? true,
            saving: false,
            dirty: false,
            isNew: !existing,
          }
        }
        setSchedules(stateMap)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        toast.error('Failed to load schedule data')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [])

  function update(accountId: string, patch: Partial<AccountScheduleState>) {
    setSchedules((prev) => ({
      ...prev,
      [accountId]: { ...prev[accountId], ...patch, dirty: true },
    }))
  }

  function toggleDay(accountId: string, day: number) {
    const current = schedules[accountId]?.daysOfWeek ?? []
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    update(accountId, { daysOfWeek: next })
  }

  function addTime(accountId: string) {
    const current = schedules[accountId]?.times ?? []
    if (current.length >= 4) return
    update(accountId, { times: [...current, '12:00'] })
  }

  function updateTime(accountId: string, index: number, value: string) {
    const times = [...(schedules[accountId]?.times ?? [])]
    times[index] = value
    update(accountId, { times })
  }

  function removeTime(accountId: string, index: number) {
    const times = (schedules[accountId]?.times ?? []).filter((_, i) => i !== index)
    update(accountId, { times })
  }

  async function saveSchedule(accountId: string) {
    const state = schedules[accountId]
    if (!state) return
    if (state.daysOfWeek.length === 0) {
      toast.error('Select at least one day')
      return
    }
    if (state.times.length === 0) {
      toast.error('Add at least one time slot')
      return
    }

    setSchedules((prev) => ({ ...prev, [accountId]: { ...prev[accountId], saving: true } }))
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedInAccountId: accountId,
          times: state.times,
          daysOfWeek: state.daysOfWeek,
          isActive: state.isActive,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save schedule')
      const wasNew = schedules[accountId]?.isNew ?? false
      setSchedules((prev) => ({ ...prev, [accountId]: { ...prev[accountId], dirty: false, isNew: false } }))
      if (wasNew) {
        toast.success('Setup complete! Redirecting to dashboard…')
        router.push('/dashboard')
      } else {
        toast.success('Schedule saved')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save schedule')
    } finally {
      setSchedules((prev) => ({ ...prev, [accountId]: { ...prev[accountId], saving: false } }))
    }
  }

  async function handleGenerateNow() {
    if (accounts.length === 0) {
      toast.error('Connect a LinkedIn account first')
      return
    }
    if (accounts.length === 1) {
      await queueGenerate(accounts[0].id)
    } else {
      setSelectedAccountId(accounts[0].id)
      setShowGenerateDialog(true)
    }
  }

  async function queueGenerate(accountId: string) {
    setGenerateLoading(true)
    const toastId = toast.loading('Queuing post generation...')
    try {
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to queue')
      toast.success('Post queued — check Posts in ~1 minute', { id: toastId })
      setShowGenerateDialog(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue post', { id: toastId })
    } finally {
      setGenerateLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Schedule</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure when posts are automatically published for each LinkedIn account
          </p>
        </div>
        {accounts.length > 0 && (
          <Button
            onClick={handleGenerateNow}
            disabled={generateLoading}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {generateLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            Generate Post Now
          </Button>
        )}
      </div>

      {/* Multi-account generate dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Post Now</DialogTitle>
            <DialogDescription>Choose which LinkedIn account to generate a post for.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={selectedAccountId} onValueChange={(v) => v && setSelectedAccountId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.displayName ?? 'LinkedIn Account'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => queueGenerate(selectedAccountId)}
              disabled={generateLoading || !selectedAccountId}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {generateLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {accounts.length === 0 ? (
        <Card className="border-gray-200">
          <CardContent className="py-16 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No LinkedIn accounts connected</p>
            <p className="text-xs text-gray-400 mt-1">
              Connect a LinkedIn account first to set up a posting schedule.
            </p>
            <a
              href="/dashboard/accounts"
              className="inline-block mt-4 text-sm text-indigo-600 hover:underline font-medium"
            >
              Go to Accounts →
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {accounts.map((account) => {
            const state = schedules[account.id]
            if (!state) return null

            return (
              <Card key={account.id} className="border-gray-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {account.displayName ?? 'LinkedIn Account'}
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        Posting schedule for this account
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${account.id}`} className="text-sm text-gray-500">
                        Active
                      </Label>
                      <Switch
                        id={`active-${account.id}`}
                        checked={state.isActive}
                        onCheckedChange={(v) => update(account.id, { isActive: v })}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Days of week */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Days of Week</Label>
                    <div className="flex gap-2 flex-wrap">
                      {DAYS.map((day) => {
                        const active = state.daysOfWeek.includes(day.value)
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDay(account.id, day.value)}
                            aria-pressed={active}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              active
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                            }`}
                          >
                            {day.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Time slots */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Posting Times</Label>
                    <div className="space-y-2">
                      {state.times.map((time, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={time}
                            onChange={(e) => updateTime(account.id, i, e.target.value)}
                            className="w-36"
                          />
                          {state.times.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTime(account.id, i)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {state.times.length < 4 && (
                      <button
                        type="button"
                        onClick={() => addTime(account.id)}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add time slot
                      </button>
                    )}
                    <p className="text-xs text-gray-400">Up to 4 time slots per day</p>
                  </div>

                  {/* Active schedule summary */}
                  {state.isActive && state.daysOfWeek.length > 0 && state.times.length > 0 && (
                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <p className="text-xs text-indigo-700 font-medium mb-1.5">Schedule preview</p>
                      <div className="flex flex-wrap gap-1">
                        {DAYS.filter((d) => state.daysOfWeek.includes(d.value)).map((d) => (
                          <Badge
                            key={d.value}
                            className="bg-indigo-100 text-indigo-700 border-0 hover:bg-indigo-100 text-xs"
                          >
                            {d.label}
                          </Badge>
                        ))}
                        <span className="text-xs text-indigo-600 self-center ml-1">at</span>
                        {state.times.map((t, i) => (
                          <Badge
                            key={i}
                            className="bg-indigo-100 text-indigo-700 border-0 hover:bg-indigo-100 text-xs"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <Button
                      onClick={() => saveSchedule(account.id)}
                      disabled={state.saving || !state.dirty}
                      className="bg-indigo-600 hover:bg-indigo-700"
                      size="sm"
                    >
                      {state.saving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
