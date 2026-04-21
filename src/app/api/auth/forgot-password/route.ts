import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto, { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { sendPasswordResetEmail } from '@/lib/email'

const schema = z.object({
  email: z.string().email(),
})

const RESPONSE = { message: 'If an account exists, a reset email has been sent.' }

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(`forgot-password:${ip}`, 5, 60, { failOpen: false })
  if (!allowed) {
    // Return same response to avoid leaking rate-limit timing info
    return NextResponse.json(RESPONSE)
  }

  try {
    const body = await req.json()
    const { email } = schema.parse(body)

    const user = await prisma.user.findUnique({ where: { email } })

    if (user && user.passwordHash) {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const hashedToken = createHash('sha256').update(rawToken).digest('hex')
      const expires = new Date(Date.now() + 3_600_000) // 1 hour

      // Delete any existing token for this email before creating a new one
      await prisma.verificationToken.deleteMany({ where: { identifier: email } })

      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token: hashedToken,
          expires,
        },
      })

      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${rawToken}`
      await sendPasswordResetEmail(email, resetUrl)
    }

    return NextResponse.json(RESPONSE)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    console.error('[forgot-password]', err)
    // Return generic response — don't leak server errors
    return NextResponse.json(RESPONSE)
  }
}
