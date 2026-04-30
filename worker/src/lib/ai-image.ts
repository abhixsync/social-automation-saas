import Groq from 'groq-sdk'

let _groq: Groq | null = null
function groqClient(): Groq {
  return (_groq ??= new Groq({ apiKey: process.env.GROQ_API_KEY }))
}

async function buildImagePrompt(topic: string, niche: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    return `${topic}, ${niche}, photorealistic, high quality, vibrant, professional`
  }
  try {
    const msg = await groqClient().chat.completions.create(
      {
        model: 'llama-3.3-70b-versatile',
        max_tokens: 80,
        messages: [
          {
            role: 'user',
            content: `Write a detailed image generation prompt for a LinkedIn post about "${topic}" in the "${niche}" niche. Be specific about lighting, style, mood, and visual elements. Make it photorealistic and visually stunning. Reply with ONLY the prompt — no explanation, no quotes.`,
          },
        ],
      },
      { signal: AbortSignal.timeout(10_000) },
    )
    const text = msg.choices[0]?.message?.content?.trim() ?? ''
    if (text.length > 10) return text
  } catch {
    // fall through to default
  }
  return `${topic}, ${niche}, photorealistic, high quality, vibrant, professional`
}

/** Generate an AI image via Pollinations.ai and return it as a Buffer. */
export async function generateAiImage(topic: string, niche: string): Promise<{ buffer: Buffer; contentType: string }> {
  const prompt = await buildImagePrompt(topic, niche)
  const seed = Math.floor(Math.random() * 1_000_000)
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`Pollinations fetch failed: ${res.status}`)

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const arrayBuffer = await res.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), contentType }
}
