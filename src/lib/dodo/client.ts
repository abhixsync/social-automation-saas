export class DodoApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'DodoApiError'
  }
}

const BASE_URL =
  process.env.DODO_ENV === 'live'
    ? 'https://api.dodopayments.com'
    : 'https://test.dodopayments.com'

export async function dodoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.DODO_API_KEY
  if (!apiKey) throw new Error('DODO_API_KEY env var is not set')

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const body = await res.json()
  if (!res.ok) {
    throw new DodoApiError(res.status, body.message ?? `Dodo API error ${res.status}`)
  }
  return body as T
}
