const PEXELS_API_URL = 'https://api.pexels.com/v1/search'

interface PexelsPhoto {
  src: { original: string; large2x: string; large: string }
  photographer: string
  photographer_url: string
}

interface PexelsResponse {
  photos: PexelsPhoto[]
  total_results: number
}

/**
 * Fetch a relevant stock photo from Pexels based on topic keywords.
 * Returns the image as a Buffer, or null if no result / API error.
 */
export async function fetchStockPhoto(
  topic: string,
  niche: string,
): Promise<Buffer | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    console.warn('[pexels] PEXELS_API_KEY not set — skipping stock photo')
    return null
  }

  // Build search query: first 3 meaningful words of topic + "professional"
  const words = topic.split(/\s+/).filter((w) => w.length > 2).slice(0, 3)
  const query = [...words, 'professional'].join(' ')

  try {
    const url = new URL(PEXELS_API_URL)
    url.searchParams.set('query', query)
    url.searchParams.set('per_page', '10')
    url.searchParams.set('orientation', 'square')
    url.searchParams.set('size', 'medium')

    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    })

    if (!res.ok) {
      console.warn(`[pexels] API returned ${res.status}: ${res.statusText}`)
      return null
    }

    const data = (await res.json()) as PexelsResponse
    if (!data.photos || data.photos.length === 0) {
      console.warn(`[pexels] No photos found for query: ${query}`)
      return null
    }

    // Pick a random photo from top 5 results
    const pick = data.photos[Math.floor(Math.random() * Math.min(5, data.photos.length))]
    const imageUrl = pick.src.large2x || pick.src.large || pick.src.original

    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      console.warn(`[pexels] Failed to download image: ${imgRes.status}`)
      return null
    }

    return Buffer.from(await imgRes.arrayBuffer())
  } catch (err) {
    console.error('[pexels] Error fetching stock photo:', err)
    return null
  }
}
