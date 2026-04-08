import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { PLAN_CONFIG } from '@/types'

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  currency: z.enum(['INR', 'USD']).default('INR'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, currency } = schema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        plan: 'free',
        currency,
        aiCreditsTotal: PLAN_CONFIG.free.creditsPerMonth,
        aiCreditsUsed: 0,
        creditsResetAt: new Date(),
      },
    })

    return NextResponse.json({ message: 'Account created' }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Validation error' }, { status: 400 })
    }
    console.error('[register]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
