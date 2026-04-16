import { decrypt } from '../../../src/lib/encryption.js'

const LINKEDIN_API_BASE = 'https://api.linkedin.com'
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION ?? '202602'

// ─── Image posting ────────────────────────────────────────────────────────────

export async function uploadImageToLinkedIn(
  accessToken: string,
  sub: string,
  imageBuffer: Buffer,
): Promise<string> {
  // Step 1: Initialize upload
  const initRes = await fetch(`${LINKEDIN_API_BASE}/rest/images?action=initializeUpload`, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
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

  const json = await initRes.json() as { value?: { uploadUrl?: string; image?: string } }
  const uploadUrl = json?.value?.uploadUrl
  const imageUrn = json?.value?.image
  if (!uploadUrl || !imageUrn) {
    throw new Error(`LinkedIn image init: unexpected response shape: ${JSON.stringify(json)}`)
  }

  // Step 2: Upload binary
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    signal: AbortSignal.timeout(60_000),
    headers: { 'Content-Type': 'image/png' },
    body: imageBuffer as unknown as BodyInit,
  })

  if (!uploadRes.ok) {
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
        altText: '',
      },
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  const res = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
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
    signal: AbortSignal.timeout(30_000),
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
