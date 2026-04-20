import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

export async function GET(req: NextRequest) {
  const { allowed } = await checkRateLimit(`geo:${getClientIp(req)}`, 30, 60, { failOpen: true })
  if (!allowed) return NextResponse.json({ currency: 'INR', country: 'IN' })

  // Vercel injects x-vercel-ip-country on all requests in production.
  // Locally this header is absent — defaults to INR.
  const country = req.headers.get('x-vercel-ip-country') ?? 'IN'
  const currency = country === 'IN' ? 'INR' : 'USD'
  return NextResponse.json({ currency, country })
}
