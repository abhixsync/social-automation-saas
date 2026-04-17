/**
 * Generate an AI image using DALL-E 3 based on the post topic and niche.
 * Returns the image as a Buffer, or throws on failure.
 */
export async function generateAIImage(
  topic: string,
  niche: string,
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  // Dynamic import so missing package doesn't crash worker on startup
  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey })

  const prompt = `Professional LinkedIn image about "${topic}" for a ${niche}. Clean, minimal, corporate style. Abstract or conceptual — no text overlay, no words, no letters. High quality, suitable for a professional social media post.`

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
  })

  const imageUrl = response.data?.[0]?.url
  if (!imageUrl) {
    throw new Error('DALL-E 3 returned no image URL')
  }

  // Download the image (DALL-E URLs expire in ~1 hour)
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) })
  if (!imgRes.ok) {
    throw new Error(`Failed to download DALL-E image: ${imgRes.status}`)
  }

  return Buffer.from(await imgRes.arrayBuffer())
}
