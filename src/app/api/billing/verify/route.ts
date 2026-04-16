import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRazorpay, verifyOrderPayment } from '@/lib/razorpay'
import { addTopupCredits } from '@/lib/credits'
import { TOPUP_CREDITS } from '@/types'
import type { Currency } from '@/generated/prisma/enums'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, quantity } = body

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    const isValid = verifyOrderPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // Idempotency: check if already processed
    const existing = await prisma.creditTopup.findUnique({
      where: { razorpayPaymentId },
    })
    if (existing) {
      return NextResponse.json({ ok: true })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, currency: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const qty = Math.min(Math.max(Number(quantity ?? 1), 1), 10)
    const credits = qty * TOPUP_CREDITS

    const order = await getRazorpay().orders.fetch(razorpayOrderId)

    await prisma.$transaction([
      prisma.creditTopup.create({
        data: {
          userId: user.id,
          credits,
          amount: Number(order.amount),
          currency: user.currency as Currency,
          razorpayPaymentId,
          razorpayOrderId,
        },
      }),
    ])

    await addTopupCredits(user.id, credits)

    return NextResponse.json({ ok: true, creditsAdded: credits })
  } catch (err) {
    console.error('[billing/verify]', err)
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 })
  }
}
