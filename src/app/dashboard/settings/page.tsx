'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save } from 'lucide-react'

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'thought_leader', label: 'Thought Leader' },
  { value: 'storyteller', label: 'Storyteller' },
]

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
]

interface Preferences {
  niche: string
  tone: string
  contentPillars: string[]
  customPromptSuffix: string | null
  approvalMode: boolean
  timezone: string
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState<Preferences>({
    niche: '',
    tone: 'professional',
    contentPillars: [],
    customPromptSuffix: '',
    approvalMode: false,
    timezone: 'Asia/Kolkata',
  })
  const [pillarsInput, setPillarsInput] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/preferences', { credentials: 'include' })
        if (res.ok) {
          const json = await res.json()
          const p: Preferences = json.preferences ?? json
          setPrefs(p)
          setPillarsInput((p.contentPillars ?? []).join(', '))
        }
      } catch {
        // preferences may not exist yet — use defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const pillars = pillarsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const res = await fetch('/api/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...prefs, contentPillars: pillars }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
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
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure your AI content preferences and posting behaviour
        </p>
      </div>

      <div className="space-y-6">
        {/* Content preferences */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Content Preferences</CardTitle>
            <CardDescription>Tell the AI about you so it can write relevant posts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="niche">Your Niche</Label>
              <Input
                id="niche"
                placeholder="e.g. software engineer, startup founder, product manager"
                value={prefs.niche}
                onChange={(e) => setPrefs((p) => ({ ...p, niche: e.target.value }))}
              />
              <p className="text-xs text-gray-400">
                Describe your professional role — used as context for every post
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tone">Writing Tone</Label>
              <Select
                value={prefs.tone}
                onValueChange={(v) => setPrefs((p) => ({ ...p, tone: v ?? p.tone }))}
              >
                <SelectTrigger id="tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pillars">Content Pillars</Label>
              <Input
                id="pillars"
                placeholder="e.g. TypeScript, System Design, Career Growth, Startups"
                value={pillarsInput}
                onChange={(e) => setPillarsInput(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                Comma-separated topics. The AI will rotate through these when picking post topics.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="suffix">Custom Prompt Suffix</Label>
              <Textarea
                id="suffix"
                placeholder="e.g. Always end with a question. Avoid buzzwords like 'synergy'."
                value={prefs.customPromptSuffix ?? ''}
                onChange={(e) => setPrefs((p) => ({ ...p, customPromptSuffix: e.target.value }))}
                rows={3}
              />
              <p className="text-xs text-gray-400">
                Optional extra instructions appended to every AI prompt
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Posting behaviour */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Posting Behaviour</CardTitle>
            <CardDescription>Control how posts are published</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Approval Mode</Label>
                <p className="text-xs text-gray-400 mt-0.5">
                  When on, posts wait in &quot;Pending Approval&quot; before publishing
                </p>
              </div>
              <Switch
                checked={prefs.approvalMode}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, approvalMode: v }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={prefs.timezone}
                onValueChange={(v) => setPrefs((p) => ({ ...p, timezone: v ?? p.timezone }))}
              >
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                Schedule times are interpreted in this timezone
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  )
}
