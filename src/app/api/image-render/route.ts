// Edge route for image generation — @vercel/og has built-in fonts in Edge runtime
// but requires explicit font data in Node.js serverless (which causes "No fonts loaded" errors).
// The /api/posts/[id]/image route authenticates + fetches DB data, then redirects here.
import { generatePostImage, type ImageStyle } from '@/lib/image-gen'

export const runtime = 'edge'

function decodeBase64url(str: string): string {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const d = searchParams.get('d')
  if (!d) return new Response('Missing data', { status: 400 })

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
