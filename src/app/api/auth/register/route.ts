import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getPlanCredits } from '@/lib/plan-settings'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { sendWelcomeEmail } from '@/lib/email'

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(`register:${ip}`, 5, 60, { failOpen: false })
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { name, email, password } = schema.parse(body)

    // Auto-detect currency from Vercel's IP country header. Falls back to INR.
    const country = req.headers.get('x-vercel-ip-country') ?? 'IN'
    const currency = country === 'IN' ? 'INR' : 'USD'

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const freeCredits = await getPlanCredits('free')

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        plan: 'free',
        currency,
        aiCreditsTotal: freeCredits,
        aiCreditsUsed: 0,
        creditsResetAt: new Date(),
      },
    })

    // Fire-and-forget — don't block signup on email failure
    sendWelcomeEmail(email, name).catch((err) =>
      console.error('[register] Failed to send welcome email:', err),
    )

    return NextResponse.json({ message: 'Account created' }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Validation error' }, { status: 400 })
    }
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }
    console.error('[register]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
