import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase())
}

export async function GET() {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ['free_credits_per_month', 'pro_credits_per_month'] } },
  })

  const result: Record<string, number> = {}
  rows.forEach((r) => { result[r.key] = parseInt(r.value, 10) })

  return NextResponse.json(result)
}
