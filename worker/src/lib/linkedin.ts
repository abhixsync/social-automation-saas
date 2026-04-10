import { decrypt } from '../../../src/lib/encryption.js'

const LINKEDIN_API_BASE = 'https://api.linkedin.com'
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION ?? '202602'

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
