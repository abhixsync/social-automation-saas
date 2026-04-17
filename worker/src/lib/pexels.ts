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

function sanitizeUserInput(input: string): string {
  return input
    .replace(/\[END\s+USER\s+STYLE\s+INSTRUCTIONS?\]/gi, '')
    .replace(/ignore\s+(all\s+)?(above|previous|prior|preceding)/gi, '')
    .replace(/\bsystem\s*:/gi, '')
    .slice(0, 500)
    .trim()
}

/**
 * Use Claude Haiku to generate a concrete, visual Pexels search query
 * from the post topic and niche. Falls back to a simple heuristic.
 */
async function buildImageQuery(topic: string, niche: string): Promise<string> {
  topic = sanitizeUserInput(topic)
  niche = sanitizeUserInput(niche)
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) throw new Error('no key')
    const { default: Groq } = await import('groq-sdk')
    const client = new Groq({ apiKey: groqKey })
    const msg = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `Give me a 2-4 word Pexels stock photo search query for a LinkedIn post about "${topic}" in the "${niche}" niche. Reply with ONLY the search keywords — no punctuation, no explanation. Make it concrete and visual; avoid proper nouns and brand names.`,
      }],
    })
    const text = msg.choices[0]?.message?.content?.trim().replace(/["""]/g, '') ?? ''
    if (text.length > 2 && text.length < 80) return text
  } catch {
    // fall through to heuristic
  }
  // Heuristic fallback: keep all words (including short ones like "AI") + first niche word
  const topicWords = topic.split(/\s+/).filter((w) => w.length > 1).slice(0, 3)
  const nicheWord = niche.split(/\s+/)[0]
  return [...topicWords, nicheWord].join(' ')
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

  const query = await buildImageQuery(topic, niche)
  console.log(`[pexels] image search query: "${query}" (topic: "${topic}")`)

  try {
    const url = new URL(PEXELS_API_URL)
    url.searchParams.set('query', query)
    url.searchParams.set('per_page', '10')
    url.searchParams.set('orientation', 'square')
    url.searchParams.set('size', 'medium')

    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(15_000),
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

    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) })
    if (!imgRes.ok) {
      console.warn(`[pexels] Failed to download image: ${imgRes.status}`)
      return null
    }

    const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
    const contentLength = parseInt(imgRes.headers.get('content-length') ?? '0', 10)
    if (contentLength > MAX_IMAGE_BYTES) {
      console.warn(`[pexels] Image too large (${contentLength} bytes), skipping`)
      return null
    }
    const arrayBuffer = await imgRes.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      console.warn(`[pexels] Downloaded image exceeds 10MB, skipping`)
      return null
    }

    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('[pexels] Error fetching stock photo:', err)
    return null
  }
}
