import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRazorpay, getPlanId } from '@/lib/razorpay'
import { z } from 'zod'
import type { Currency } from '@/generated/prisma/enums'

const schema = z.object({
  plan: z.enum(['pro']),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { plan } = schema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        razorpayCustomerId: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const currency = user.currency as Currency

    let razorpayCustomerId = user.razorpayCustomerId
    if (!razorpayCustomerId) {
      const customer = await getRazorpay().customers.create({
        name: user.name ?? '',
        email: user.email ?? '',
      })
      razorpayCustomerId = customer.id
      await prisma.user.update({
        where: { id: user.id },
        data: { razorpayCustomerId },
      })
    }

    const planId = getPlanId(plan, currency)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = await (getRazorpay().subscriptions.create as any)({
      plan_id: planId,
      customer_notify: 1,
      quantity: 1,
      total_count: 120,
      customer_id: razorpayCustomerId,
    })

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
