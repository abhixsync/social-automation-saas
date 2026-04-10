import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { removeUserSchedule } from '@/lib/scheduler'
import { z } from 'zod'

const schema = z.object({ accountId: z.string() })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { accountId } = schema.parse(await req.json())

    // Verify account belongs to user
    const account = await prisma.linkedInAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    })
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Soft delete — mark inactive, wipe token
    await prisma.linkedInAccount.update({
      where: { id: accountId },
      data: {
        isActive: false,
        accessTokenEncrypted: '', // clear token for security
      },
    })

    // Also deactivate any schedules using this account
    await prisma.postSchedule.updateMany({
      where: { linkedInAccountId: accountId, userId: session.user.id },
      data: { isActive: false },
    })

    // Remove BullMQ jobs so the worker stops firing for this disconnected account
    await removeUserSchedule(session.user.id, accountId)

    return NextResponse.json({ message: 'LinkedIn account disconnected' })
  } catch (err) {
    console.error('[linkedin/disconnect]', err)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
