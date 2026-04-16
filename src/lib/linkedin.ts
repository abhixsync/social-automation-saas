import { encrypt, decrypt } from '@/lib/encryption'

const LINKEDIN_API_BASE = 'https://api.linkedin.com'
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION ?? '202602'

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export function buildLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    scope: 'w_member_social openid profile',
    state,
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
  })

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LinkedIn token exchange failed: ${err}`)
  }

  return res.json()
}

export async function getLinkedInUserInfo(accessToken: string): Promise<{
  sub: string
  name: string
  picture?: string
}> {
  const res = await fetch(`${LINKEDIN_API_BASE}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LinkedIn userinfo failed: ${err}`)
  }

  return res.json()
}

// ─── Posting ──────────────────────────────────────────────────────────────────

export async function postToLinkedIn(
  accessTokenEncrypted: string,
  sub: string,
  postText: string,
): Promise<void> {
  const accessToken = decrypt(accessTokenEncrypted)

  const body = {
    author: `urn:li:person:${sub}`,
    commentary: postText,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  const res = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': LINKEDIN_VERSION,
    },
    body: JSON.stringify(body),
  })

  // LinkedIn returns 201 with empty body on success
  if (res.status !== 201) {
    const err = await res.text()
    throw new Error(`LinkedIn post failed (${res.status}): ${err}`)
  }
}

// ─── Image posting ────────────────────────────────────────────────────────────

export async function uploadImageToLinkedIn(
  accessToken: string,
  sub: string,
  imageBuffer: Buffer,
): Promise<string> {
  // Step 1: Initialize upload
  const initRes = await fetch(`${LINKEDIN_API_BASE}/rest/images?action=initializeUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': LINKEDIN_VERSION,
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: `urn:li:person:${sub}`,
      },
    }),
  })

  if (!initRes.ok) {
    const err = await initRes.text()
    throw new Error(`LinkedIn image init failed (${initRes.status}): ${err}`)
  }

  const { value } = await initRes.json() as {
    value: { uploadUrl: string; image: string }
  }
  const { uploadUrl, image: imageUrn } = value

  // Step 2: Upload binary
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: imageBuffer as unknown as BodyInit,
  })

  if (!uploadRes.ok && uploadRes.status !== 201) {
    const err = await uploadRes.text()
    throw new Error(`LinkedIn image upload failed (${uploadRes.status}): ${err}`)
  }

  return imageUrn
}

export async function postToLinkedInWithImage(
  accessTokenEncrypted: string,
  sub: string,
  postText: string,
  imageBuffer: Buffer,
): Promise<void> {
  const accessToken = decrypt(accessTokenEncrypted)
  const imageUrn = await uploadImageToLinkedIn(accessToken, sub, imageBuffer)

  const body = {
    author: `urn:li:person:${sub}`,
    commentary: postText,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: {
      media: {
        id: imageUrn,
      },
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  const res = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': LINKEDIN_VERSION,
    },
    body: JSON.stringify(body),
  })

  if (res.status !== 201) {
    const err = await res.text()
    throw new Error(`LinkedIn image post failed (${res.status}): ${err}`)
  }
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export { encrypt as encryptToken, decrypt as decryptToken }

export function tokenExpiresAt(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000)
}
