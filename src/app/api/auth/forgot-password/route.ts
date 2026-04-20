import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

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

    if (user) {
      // TODO: send actual reset email via resend
      console.log('[forgot-password] Reset requested for user')
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
