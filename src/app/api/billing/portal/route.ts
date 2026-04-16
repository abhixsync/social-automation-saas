import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Billing portal is not available' }, { status: 404 })
}
