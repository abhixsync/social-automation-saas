import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { PLAN_CONFIG } from '@/types'
import type { Plan } from '@/generated/prisma/enums'
import AccountsClient from './AccountsClient'

export default async function AccountsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const accounts = await prisma.linkedInAccount.findMany({
    where: { userId: session.user.id, isActive: true },
    select: {
      id: true,
      displayName: true,
      profilePicture: true,
      expiresAt: true,
      connectedAt: true,
      sub: true,
    },
    orderBy: { connectedAt: 'desc' },
  })

  const maxAccounts = PLAN_CONFIG[session.user.plan as Plan].maxAccounts
  const plan = session.user.plan

  return (
    <AccountsClient
      accounts={accounts.map((a) => ({
        ...a,
        expiresAt: a.expiresAt.toISOString(),
        connectedAt: a.connectedAt.toISOString(),
      }))}
      maxAccounts={maxAccounts}
      plan={plan}
    />
  )
}
