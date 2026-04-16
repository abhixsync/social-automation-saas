'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PLAN_CONFIG } from '@/types'

export default function AdminSettingsPage() {
  const [freeCredits, setFreeCredits] = useState('')
  const [proCredits, setProCredits] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings/current')
      .then((r) => r.json())
      .then((data) => {
        setFreeCredits(String(data.free_credits_per_month ?? PLAN_CONFIG.free.creditsPerMonth))
        setProCredits(String(data.pro_credits_per_month ?? PLAN_CONFIG.pro.creditsPerMonth))
      })
      .catch(() => {
        setFreeCredits(String(PLAN_CONFIG.free.creditsPerMonth))
        setProCredits(String(PLAN_CONFIG.pro.creditsPerMonth))
      })
  }, [])

  async function handleSave() {
    const free = parseInt(freeCredits, 10)
    const pro = parseInt(proCredits, 10)

    if (isNaN(free) || free < 1 || isNaN(pro) || pro < 1) {
      setMessage({ type: 'error', text: 'Credits must be positive numbers.' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          free_credits_per_month: free,
          pro_credits_per_month: pro,
        }),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully.' })
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error ?? 'Failed to save.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Plan Settings</h1>

      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Credit Limits per Plan</CardTitle>
          <p className="text-sm text-gray-500 mt-0.5">
            Applies to new subscribers and monthly resets. Existing users are not affected until their next cycle.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Free plan — credits/month
            </label>
            <Input
              type="number"
              min={1}
              value={freeCredits}
              onChange={(e) => setFreeCredits(e.target.value)}
              placeholder={String(PLAN_CONFIG.free.creditsPerMonth)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Default: {PLAN_CONFIG.free.creditsPerMonth} · 1 credit = 50 words
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Pro plan — credits/month
            </label>
            <Input
              type="number"
              min={1}
              value={proCredits}
              onChange={(e) => setProCredits(e.target.value)}
              placeholder={String(PLAN_CONFIG.pro.creditsPerMonth)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Default: {PLAN_CONFIG.pro.creditsPerMonth} · 1 credit = 50 words
            </p>
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
