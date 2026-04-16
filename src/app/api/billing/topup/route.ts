import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRazorpay, TOPUP_AMOUNT, RAZORPAY_CURRENCY } from '@/lib/razorpay'
import type { Currency } from '@/generated/prisma/enums'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const rawQty = Number(body.quantity ?? 1)
    const qty = Math.min(Math.max(Number.isInteger(rawQty) ? rawQty : 1, 1), 10)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, currency: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const currency = user.currency as Currency

    const order = await getRazorpay().orders.create({
      amount: TOPUP_AMOUNT[currency] * qty,
      currency: RAZORPAY_CURRENCY[currency],
      receipt: `topup_${user.id}_${Date.now()}`,
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('[billing/topup]', err)
    return NextResponse.json({ error: 'Failed to create top-up order' }, { status: 500 })
  }
}
