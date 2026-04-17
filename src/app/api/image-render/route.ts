// Edge route for image generation — @vercel/og has built-in fonts in Edge runtime
// but requires explicit font data in Node.js serverless (which causes "No fonts loaded" errors).
// The /api/posts/[id]/image route authenticates + fetches DB data, then redirects here.
// This route verifies a signature to prevent unauthenticated abuse.
import { generatePostImage, type ImageStyle } from '@/lib/image-gen'

export const runtime = 'edge'

function decodeBase64url(str: string): string {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function computeSig(data: string): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? ''
  const msgBuf = new TextEncoder().encode(data + secret)
  const hashBuf = await crypto.subtle.digest('SHA-256', msgBuf)
  return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const d = searchParams.get('d')
  const sig = searchParams.get('sig')
  if (!d) return new Response('Missing data', { status: 400 })

  // Verify signature to prevent unauthenticated image generation
  const expectedSig = await computeSig(d)
  if (!sig || sig !== expectedSig) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const opts = JSON.parse(decodeBase64url(d)) as {
      style: ImageStyle
      content: string
      topic: string
      niche: string
      displayName: string
      plan: 'free' | 'pro'
      brandColor?: string
      profilePictureUrl?: string
      showProfilePic?: boolean
    }

    const buffer = await generatePostImage(opts)
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[image-render]', err)
    return new Response('Image generation failed', { status: 500 })
  }
}
