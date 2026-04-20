import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'
import { isAdmin } from '@/lib/admin'

export async function GET() {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { allowed } = await checkRateLimit(`admin-settings-current:${session?.user?.id}`, 30, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ['free_credits_per_month', 'pro_credits_per_month'] } },
  })

  const result: Record<string, number> = {}
  rows.forEach((r) => { result[r.key] = parseInt(r.value, 10) })

  return NextResponse.json(result)
}
