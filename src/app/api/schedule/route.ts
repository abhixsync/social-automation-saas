import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { upsertUserSchedule, removeUserSchedule } from '@/lib/scheduler'
import { z } from 'zod'

const schema = z.object({
  linkedInAccountId: z.string(),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(4),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  isActive: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = req.nextUrl.searchParams.get('accountId')

  try {
    const schedules = await prisma.postSchedule.findMany({
      where: {
        userId: session.user.id,
        ...(accountId ? { linkedInAccountId: accountId } : {}),
      },
      include: {
        linkedInAccount: { select: { displayName: true, profilePicture: true, sub: true } },
      },
    })
    return NextResponse.json({ schedules })
  } catch (err) {
    console.error('[schedule/GET]', err)
    return NextResponse.json({ error: 'Failed to load schedules' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { linkedInAccountId, times, daysOfWeek, isActive } = schema.parse(body)

    // Verify account belongs to user
    const account = await prisma.linkedInAccount.findFirst({
      where: { id: linkedInAccountId, userId: session.user.id, isActive: true },
    })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    // Get user timezone from preferences
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
      select: { timezone: true },
    })
    const timezone = prefs?.timezone ?? 'Asia/Kolkata'

    const schedule = await prisma.postSchedule.upsert({
      where: { userId_linkedInAccountId: { userId: session.user.id, linkedInAccountId } },
      update: { times, daysOfWeek, isActive, updatedAt: new Date() },
      create: { userId: session.user.id, linkedInAccountId, times, daysOfWeek, isActive },
    })

    // Sync BullMQ schedulers
    if (isActive) {
      await upsertUserSchedule(session.user.id, linkedInAccountId, times, daysOfWeek, timezone)
    } else {
      await removeUserSchedule(session.user.id, linkedInAccountId)
    }

    return NextResponse.json({ schedule })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 })
    }
    console.error('[schedule/POST]', err)
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = req.nextUrl.searchParams.get('accountId')
  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })

  await prisma.postSchedule.updateMany({
    where: { userId: session.user.id, linkedInAccountId: accountId },
    data: { isActive: false },
  })
  await removeUserSchedule(session.user.id, accountId)

  return NextResponse.json({ message: 'Schedule removed' })
}
