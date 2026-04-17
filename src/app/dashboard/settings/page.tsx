'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

const IMAGE_STYLES = [
  {
    value: 'quote_card',
    label: 'Quote Card',
    description: 'Hook text on a gradient purple background',
    preview: (
      <div className="w-full h-20 rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center p-3">
        <p className="text-white text-xs font-semibold text-center leading-tight line-clamp-3">
          &ldquo;The best time to start was yesterday. The next best time is now.&rdquo;
        </p>
      </div>
    ),
  },
  {
    value: 'stats_card',
    label: 'Stats Card',
    description: 'Big number or metric on a pink/red gradient',
    preview: (
      <div className="w-full h-20 rounded-md bg-gradient-to-br from-pink-500 to-red-500 flex flex-col items-center justify-center p-3">
        <p className="text-white text-2xl font-bold">10x</p>
        <p className="text-pink-100 text-xs mt-0.5">productivity boost</p>
      </div>
    ),
  },
  {
    value: 'topic_card',
    label: 'Topic Card',
    description: 'Topic title on a gradient blue background',
    preview: (
      <div className="w-full h-20 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center p-3">
        <p className="text-white text-sm font-bold text-center">System Design Patterns</p>
      </div>
    ),
  },
  {
    value: 'minimal_light',
    label: 'Minimal Light',
    description: 'Clean white card with dark text',
    preview: (
      <div className="w-full h-20 rounded-md bg-white border border-gray-200 flex items-center justify-center p-3">
        <p className="text-gray-800 text-xs font-semibold text-center leading-tight">
          Clean, professional typography on white
        </p>
      </div>
    ),
  },
  {
    value: 'minimal_dark',
    label: 'Minimal Dark',
    description: 'Sleek dark card with white text',
    preview: (
      <div className="w-full h-20 rounded-md bg-gradient-to-br from-gray-900 to-slate-800 flex items-center justify-center p-3">
        <p className="text-white text-xs font-semibold text-center leading-tight">
          Modern dark mode aesthetic
        </p>
      </div>
    ),
  },
  {
    value: 'list_card',
    label: 'List Card',
    description: 'Numbered bullet points on an indigo gradient',
    preview: (
      <div className="w-full h-20 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex flex-col justify-center p-3 gap-0.5">
        <p className="text-white text-xs font-medium">1. First key point</p>
        <p className="text-white text-xs font-medium">2. Second key point</p>
        <p className="text-white text-xs font-medium">3. Third key point</p>
      </div>
    ),
  },
  {
    value: 'ai_generated',
    label: 'AI Generated',
    description: 'DALL-E 3 image based on post topic (20 credits)',
    preview: (
      <div className="w-full h-20 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center p-3 gap-2">
        <svg className="w-6 h-6 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
        <p className="text-white text-xs font-semibold">AI-generated image</p>
      </div>
    ),
  },
  {
    value: 'stock_photo',
    label: 'Stock Photo',
    description: 'Relevant stock photo from Pexels based on post topic',
    preview: (
      <div className="w-full h-20 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center p-3 gap-2">
        <svg className="w-6 h-6 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
        <p className="text-white text-xs font-semibold">Auto-picked photo</p>
      </div>
    ),
  },
]

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
  imageStyle: 'quote_card' | 'stats_card' | 'topic_card' | 'minimal_light' | 'minimal_dark' | 'list_card' | 'stock_photo' | 'ai_generated'
  autoImage: boolean
  brandColor: string | null
  showProfilePicOnCard: boolean
}

const DEFAULT_PREFS: Preferences = {
  niche: '',
  tone: 'professional',
  contentPillars: [],
  customPromptSuffix: '',
  approvalMode: false,
  timezone: 'Asia/Kolkata',
  imageStyle: 'quote_card',
  autoImage: true,
  brandColor: null,
  showProfilePicOnCard: false,
}

function serializeState(p: Preferences, pillars: string) {
  return JSON.stringify({
    niche: p.niche,
    tone: p.tone,
    customPromptSuffix: p.customPromptSuffix ?? '',
    approvalMode: p.approvalMode,
    timezone: p.timezone,
    imageStyle: p.imageStyle,
    autoImage: p.autoImage,
    brandColor: p.brandColor ?? '',
    showProfilePicOnCard: p.showProfilePicOnCard,
    pillars: pillars.split(',').map((s) => s.trim()).filter(Boolean).join('|'),
  })
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS)
  const [pillarsInput, setPillarsInput] = useState('')
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [isFirstSetup, setIsFirstSetup] = useState(false)

  const isDirty = savedSnapshot !== null && serializeState(prefs, pillarsInput) !== savedSnapshot

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/preferences', { credentials: 'include' })
        if (res.ok) {
          const json = await res.json()
          const p: Preferences = json.preferences ?? json
          const pi = (p.contentPillars ?? []).join(', ')
          setPrefs(p)
          setPillarsInput(pi)
          setSavedSnapshot(serializeState(p, pi))
          // Treat as first-time setup if niche hasn't been filled in yet
          setIsFirstSetup(!p.niche)
        } else {
          // No preferences yet — snapshot defaults so any change enables Save
          setSavedSnapshot(serializeState(DEFAULT_PREFS, ''))
          setIsFirstSetup(true)
        }
      } catch {
        // preferences may not exist yet — use defaults
        setSavedSnapshot(serializeState(DEFAULT_PREFS, ''))
        setIsFirstSetup(true)
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
      setSavedSnapshot(serializeState(prefs, pillarsInput))
      if (isFirstSetup) {
        setIsFirstSetup(false)
        toast.success('Preferences saved!', {
          description: 'Continue your setup from the dashboard.',
          action: { label: 'Dashboard →', onClick: () => router.push('/dashboard') },
          duration: 7000,
        })
      } else {
        toast.success('Settings saved')
      }
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

        {/* Image Posts */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Image Posts</CardTitle>
            <CardDescription>Control how image cards look when included with posts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Image Style</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {IMAGE_STYLES.map((style) => {
                  const selected = prefs.imageStyle === style.value
                  return (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() =>
                        setPrefs((p) => ({
                          ...p,
                          imageStyle: style.value as Preferences['imageStyle'],
                        }))
                      }
                      className={`rounded-lg border-2 p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {style.preview}
                      <p className={`mt-2 text-xs font-medium ${selected ? 'text-indigo-700' : 'text-gray-700'}`}>
                        {style.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{style.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brandColor">Brand Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="brandColor"
                  value={prefs.brandColor ?? '#667eea'}
                  onChange={(e) => setPrefs((p) => ({ ...p, brandColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                />
                <Input
                  value={prefs.brandColor ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setPrefs((p) => ({ ...p, brandColor: v || null }))
                    }
                  }}
                  placeholder="#667eea"
                  className="w-32 font-mono text-sm"
                  maxLength={7}
                />
                {prefs.brandColor && (
                  <button
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, brandColor: null }))}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Overrides the default gradient on image cards with your brand color
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Show profile picture</Label>
                <p className="text-xs text-gray-400 mt-0.5">
                  Display your LinkedIn profile picture in the corner of image cards
                </p>
              </div>
              <Switch
                checked={prefs.showProfilePicOnCard}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, showProfilePicOnCard: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Auto-include image</Label>
                <p className="text-xs text-gray-400 mt-0.5">
                  Automatically include an image with every post
                </p>
                <p className="text-xs text-gray-400">
                  For posts in approval mode, you can toggle per post.
                </p>
              </div>
              <Switch
                checked={prefs.autoImage}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, autoImage: v }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !isDirty}
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
