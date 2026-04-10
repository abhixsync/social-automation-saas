import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await prisma.linkedInAccount.findMany({
    where: { userId: session.user.id, isActive: true },
    select: {
      id: true,
      displayName: true,
      profilePicture: true,
      sub: true,
      expiresAt: true,
      connectedAt: true,
    },
    orderBy: { connectedAt: 'desc' },
  })

  return NextResponse.json({ accounts })
}
