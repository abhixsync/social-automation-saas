const DODO_BASE_URL =
  process.env.DODO_ENV === 'live'
    ? 'https://live.dodopayments.com'
    : 'https://test.dodopayments.com'

export class DodoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message)
    this.name = 'DodoApiError'
  }
}

/**
 * Thin fetch wrapper for the Dodo Payments REST API.
 * Auth: Bearer token from DODO_API_KEY env var.
 * Throws DodoApiError on non-2xx responses.
 */
export async function dodoFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const apiKey = process.env.DODO_API_KEY
  if (!apiKey) throw new Error('DODO_API_KEY env var is not set')

  const res = await fetch(`${DODO_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (body as { message?: string } | null)?.message ?? `Dodo API error ${res.status}`
    throw new DodoApiError(message, res.status, body)
  }
  return body as T
}
