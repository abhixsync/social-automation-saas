import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'

const ALLOWED_KEYS = ['free_credits_per_month', 'pro_credits_per_month', 'app_mode']

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase())
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { allowed } = await checkRateLimit(`admin-settings:${session?.user?.id}`, 10, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const body = await req.json()
  const updates: { key: string; value: string }[] = []

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.includes(key)) continue
    if (typeof value !== 'string' && typeof value !== 'number') continue
    updates.push({ key, value: String(value) })
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No valid keys provided' }, { status: 400 })
  }

  await Promise.all(
    updates.map((u) =>
      prisma.siteSetting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      })
    )
  )

  return NextResponse.json({ ok: true, updated: updates.map((u) => u.key) })
}
