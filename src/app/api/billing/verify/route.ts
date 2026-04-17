import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRazorpay, verifyOrderPayment, TOPUP_AMOUNT } from '@/lib/razorpay'
import { TOPUP_CREDITS } from '@/types'
import type { Currency } from '@/generated/prisma/enums'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { allowed } = await checkRateLimit(`billing-verify:${session.user.id}`, 10, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = body

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

    // Fetch verified order from Razorpay — derive qty from amount, not user input
    // (prevents client-side quantity manipulation: pay qty=1, claim qty=10)
    const order = await getRazorpay().orders.fetch(razorpayOrderId)
    const currency = user.currency as Currency
    const qty = Math.max(1, Math.round(Number(order.amount) / TOPUP_AMOUNT[currency]))
    const credits = qty * TOPUP_CREDITS

    // Atomic: record topup AND increment credits in one transaction.
    // Previously addTopupCredits was outside the transaction — if the server
    // crashed after the record was created, idempotency would block any retry
    // and the user would lose their credits permanently.
    await prisma.$transaction([
      prisma.creditTopup.create({
        data: {
          userId: user.id,
          credits,
          amount: Number(order.amount),
          currency,
          razorpayPaymentId,
          razorpayOrderId,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { aiCreditsTotal: { increment: credits } },
      }),
    ])

    return NextResponse.json({ ok: true, creditsAdded: credits })
  } catch (err) {
    console.error('[billing/verify]', err)
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 })
  }
}
