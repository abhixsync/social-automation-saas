import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Vercel injects x-vercel-ip-country on all requests in production.
  // Locally this header is absent — defaults to INR.
  const country = req.headers.get('x-vercel-ip-country') ?? 'IN'
  const currency = country === 'IN' ? 'INR' : 'USD'
  return NextResponse.json({ currency, country })
}
