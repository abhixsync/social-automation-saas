import { ImageResponse } from '@vercel/og'

export type ImageStyle = 'quote_card' | 'stats_card' | 'topic_card'

// Use Satori's built-in fonts — avoids WOFF2/variable-font/binary-corruption issues.
function getFont(): ArrayBuffer | null {
  return null
}

// Extract the hook line (first sentence) from a LinkedIn post
function extractHook(content: string): string {
  const firstLine = content.split('\n')[0].trim()
  return firstLine.length > 120 ? firstLine.slice(0, 117) + '…' : firstLine
}

// Parse the most prominent stat/number from post content
function extractStat(content: string): { number: string; label: string } | null {
  const patterns = [
    /(\d+(?:\.\d+)?[xX])\s+([^.\n]{5,40})/,     // 5x engagement
    /(\d+(?:\.\d+)?%)\s+([^.\n]{5,40})/,          // 40% increase
    /\$(\d+[KMB]?)\s+([^.\n]{5,40})/,             // $1M revenue
    /(\d+)\s+(steps?|tips?|ways?|rules?|hours?|days?|years?)/i, // 3 steps
    /(\d{2,})\s+([^.\n]{5,40})/,                   // 10 companies
  ]
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      return { number: match[1], label: match[2].trim().slice(0, 40) }
    }
  }
  return null
}

const GRADIENTS: Record<ImageStyle, [string, string]> = {
  quote_card: ['#667eea', '#764ba2'],
  stats_card: ['#f093fb', '#f5576c'],
  topic_card: ['#4facfe', '#00f2fe'],
}

export async function generatePostImage(opts: {
  style: ImageStyle
  content: string
  topic: string
  niche: string
  displayName: string
  plan: 'free' | 'pro'
}): Promise<Buffer> {
  const { style, content, topic, niche, displayName, plan } = opts
  const font = getFont()
  const [from, to] = GRADIENTS[style]
  const showWatermark = plan === 'free'
  const fontFamily = font ? 'Inter' : 'sans-serif'

  let jsx: React.ReactNode

  if (style === 'stats_card') {
    const stat = extractStat(content)
    if (stat) {
      jsx = (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${from}, ${to})`,
            padding: '80px',
            fontFamily,
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', fontSize: 160, fontWeight: 700, color: 'white', lineHeight: 1 }}>
            {stat.number}
          </div>
          <div style={{ display: 'flex', fontSize: 36, color: 'rgba(255,255,255,0.85)', marginTop: 24, textAlign: 'center' }}>
            {stat.label}
          </div>
          <div style={{ display: 'flex', marginTop: 60, fontSize: 22, color: 'rgba(255,255,255,0.65)' }}>
            {displayName} · {niche}
          </div>
          {showWatermark && (
            <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>
              Crescova
            </div>
          )}
        </div>
      )
    } else {
      // No stat found — render hook text on the stats_card gradient so user's chosen style is preserved
      const hook = extractHook(content)
      jsx = (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${from}, ${to})`,
            padding: '80px',
            fontFamily,
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>
            ❝
          </div>
          <div style={{ display: 'flex', fontSize: hook.length > 80 ? 42 : 52, fontWeight: 600, color: 'white', textAlign: 'center', lineHeight: 1.3 }}>
            {hook}
          </div>
          <div style={{ display: 'flex', marginTop: 48, fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>
            — {displayName}
          </div>
          {showWatermark && (
            <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>
              Crescova
            </div>
          )}
        </div>
      )
    }
  } else if (style === 'topic_card') {
    jsx = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: `linear-gradient(135deg, ${from}, ${to})`,
          padding: '80px',
          fontFamily,
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 4, marginBottom: 24 }}>
          {niche}
        </div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
          {topic.length > 60 ? topic.slice(0, 57) + '…' : topic}
        </div>
        <div style={{ display: 'flex', marginTop: 60, fontSize: 24, color: 'rgba(255,255,255,0.75)' }}>
          — {displayName}
        </div>
        {showWatermark && (
          <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>
            Crescova
          </div>
        )}
      </div>
    )
  } else {
    // quote_card (default)
    const hook = extractHook(content)
    jsx = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: `linear-gradient(135deg, ${from}, ${to})`,
          padding: '80px',
          fontFamily,
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>
          ❝
        </div>
        <div style={{ display: 'flex', fontSize: hook.length > 80 ? 42 : 52, fontWeight: 600, color: 'white', textAlign: 'center', lineHeight: 1.3 }}>
          {hook}
        </div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>
          — {displayName}
        </div>
        {showWatermark && (
          <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>
            Crescova
          </div>
        )}
      </div>
    )
  }

  const response = new ImageResponse(jsx, {
    width: 1080,
    height: 1080,
    ...(font ? { fonts: [{ name: 'Inter', data: font, weight: 400 }] } : {}),
  })

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
