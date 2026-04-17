import { ImageResponse } from '@vercel/og'

export type ImageStyle = 'quote_card' | 'stats_card' | 'topic_card' | 'minimal_light' | 'minimal_dark' | 'list_card' | 'stock_photo' | 'ai_generated'

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

// Extract bullet points from post content for list_card
function extractBullets(content: string): string[] {
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 10)
  // Try numbered/bulleted lines first
  const bullets = lines.filter((l) => /^[\d•\-*]/.test(l))
  if (bullets.length >= 2) return bullets.slice(0, 5).map((b) => b.replace(/^[\d•\-*]+[.):\s]*/, '').slice(0, 60))
  // Fall back to first 3-5 non-empty lines (skip the hook line)
  return lines.slice(1, 5).map((l) => l.slice(0, 60))
}

// Darken a hex color by a percentage
function darkenHex(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16)
  const factor = 1 - percent / 100
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * factor))
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * factor))
  const b = Math.max(0, Math.round((num & 0xff) * factor))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

const GRADIENTS: Record<ImageStyle, [string, string]> = {
  quote_card: ['#667eea', '#764ba2'],
  stats_card: ['#f093fb', '#f5576c'],
  topic_card: ['#4facfe', '#00f2fe'],
  minimal_light: ['#ffffff', '#f8f9fa'],
  minimal_dark: ['#1a1a2e', '#16213e'],
  list_card: ['#667eea', '#764ba2'],
  stock_photo: ['#10b981', '#059669'],
  ai_generated: ['#f59e0b', '#d97706'],
}

export async function generatePostImage(opts: {
  style: ImageStyle
  content: string
  topic: string
  niche: string
  displayName: string
  plan: 'free' | 'pro'
  brandColor?: string
  profilePictureUrl?: string
  showProfilePic?: boolean
}): Promise<Buffer> {
  const { style, content, topic, niche, displayName, plan, brandColor, profilePictureUrl, showProfilePic } = opts
  const font = getFont()
  let [from, to] = GRADIENTS[style]
  const showWatermark = plan === 'free'
  const fontFamily = font ? 'Inter' : 'sans-serif'

  // Validate brandColor — malformed hex crashes darkenHex
  const validBrandColor = brandColor && /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : undefined

  // Brand color override for gradient-based styles
  if (validBrandColor && style !== 'minimal_light' && style !== 'minimal_dark') {
    from = validBrandColor
    to = darkenHex(validBrandColor, 25)
  }

  // Accent color for minimal styles
  const accentColor = validBrandColor ?? (style === 'minimal_dark' ? '#818cf8' : '#4f46e5')

  // Watermark text color adapts to card background
  const wmColor = style === 'minimal_light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.3)'

  let jsx: React.ReactNode

  if (style === 'stats_card') {
    const stat = extractStat(content)
    if (stat) {
      jsx = (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: `linear-gradient(135deg, ${from}, ${to})`, padding: '80px', fontFamily, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', fontSize: 160, fontWeight: 700, color: 'white', lineHeight: 1 }}>{stat.number}</div>
          <div style={{ display: 'flex', fontSize: 36, color: 'rgba(255,255,255,0.85)', marginTop: 24, textAlign: 'center' }}>{stat.label}</div>
          <div style={{ display: 'flex', marginTop: 60, fontSize: 22, color: 'rgba(255,255,255,0.65)' }}>{displayName} · {niche}</div>
          {showProfilePic && profilePictureUrl && <img src={profilePictureUrl} width={64} height={64} style={{ position: 'absolute', bottom: 32, left: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)' }} />}
          {showWatermark && <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: wmColor }}>Crescova</div>}
        </div>
      )
    } else {
      const hook = extractHook(content)
      jsx = (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: `linear-gradient(135deg, ${from}, ${to})`, padding: '80px', fontFamily, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>❝</div>
          <div style={{ display: 'flex', fontSize: hook.length > 80 ? 42 : 52, fontWeight: 600, color: 'white', textAlign: 'center', lineHeight: 1.3 }}>{hook}</div>
          <div style={{ display: 'flex', marginTop: 48, fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>— {displayName}</div>
          {showProfilePic && profilePictureUrl && <img src={profilePictureUrl} width={64} height={64} style={{ position: 'absolute', bottom: 32, left: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)' }} />}
          {showWatermark && <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: wmColor }}>Crescova</div>}
        </div>
      )
    }
  } else if (style === 'topic_card') {
    jsx = (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: `linear-gradient(135deg, ${from}, ${to})`, padding: '80px', fontFamily, justifyContent: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 4, marginBottom: 24 }}>{niche}</div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{topic.length > 60 ? topic.slice(0, 57) + '…' : topic}</div>
        <div style={{ display: 'flex', marginTop: 60, fontSize: 24, color: 'rgba(255,255,255,0.75)' }}>— {displayName}</div>
        {showProfilePic && profilePictureUrl && <img src={profilePictureUrl} width={64} height={64} style={{ position: 'absolute', bottom: 32, left: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)' }} />}
        {showWatermark && <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: wmColor }}>Crescova</div>}
      </div>
    )
  } else if (style === 'minimal_light') {
    const hook = extractHook(content)
    jsx = (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#ffffff', padding: '100px', fontFamily, justifyContent: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', width: 60, height: 4, background: accentColor, marginBottom: 40, borderRadius: 2 }} />
        <div style={{ display: 'flex', fontSize: hook.length > 80 ? 44 : 56, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.25 }}>{hook}</div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 24, color: '#6b7280' }}>— {displayName}</div>
        <div style={{ display: 'flex', marginTop: 8, fontSize: 18, color: accentColor, textTransform: 'uppercase', letterSpacing: 3 }}>{niche}</div>
        {showProfilePic && profilePictureUrl && <img src={profilePictureUrl} width={64} height={64} style={{ position: 'absolute', bottom: 40, left: 100, borderRadius: '50%', border: `3px solid ${accentColor}` }} />}
        {showWatermark && <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: wmColor }}>Crescova</div>}
      </div>
    )
  } else if (style === 'minimal_dark') {
    const hook = extractHook(content)
    jsx = (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'linear-gradient(180deg, #1a1a2e, #16213e)', padding: '100px', fontFamily, justifyContent: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', width: 60, height: 4, background: accentColor, marginBottom: 40, borderRadius: 2 }} />
        <div style={{ display: 'flex', fontSize: hook.length > 80 ? 44 : 56, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.25 }}>{hook}</div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 24, color: '#94a3b8' }}>— {displayName}</div>
        <div style={{ display: 'flex', marginTop: 8, fontSize: 18, color: accentColor, textTransform: 'uppercase', letterSpacing: 3 }}>{niche}</div>
        {showProfilePic && profilePictureUrl && <img src={profilePictureUrl} width={64} height={64} style={{ position: 'absolute', bottom: 40, left: 100, borderRadius: '50%', border: `3px solid ${accentColor}` }} />}
        {showWatermark && <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: wmColor }}>Crescova</div>}
      </div>
    )
  } else if (style === 'list_card') {
    const bullets = extractBullets(content)
    jsx = (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: `linear-gradient(135deg, ${from}, ${to})`, padding: '80px', fontFamily, justifyContent: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', fontSize: 48, fontWeight: 700, color: 'white', lineHeight: 1.2, marginBottom: 40 }}>{topic.length > 50 ? topic.slice(0, 47) + '…' : topic}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ display: 'flex', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3, paddingTop: 2 }}>{b}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 20, color: 'rgba(255,255,255,0.6)' }}>{displayName} · {niche}</div>
        {showProfilePic && profilePictureUrl && <img src={profilePictureUrl} width={64} height={64} style={{ position: 'absolute', bottom: 32, left: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)' }} />}
        {showWatermark && <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: wmColor }}>Crescova</div>}
      </div>
    )
  } else {
    // quote_card (default)
    const hook = extractHook(content)
    jsx = (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: `linear-gradient(135deg, ${from}, ${to})`, padding: '80px', fontFamily, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>❝</div>
        <div style={{ display: 'flex', fontSize: hook.length > 80 ? 42 : 52, fontWeight: 600, color: 'white', textAlign: 'center', lineHeight: 1.3 }}>{hook}</div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>— {displayName}</div>
        {showProfilePic && profilePictureUrl && <img src={profilePictureUrl} width={64} height={64} style={{ position: 'absolute', bottom: 32, left: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)' }} />}
        {showWatermark && <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 40, fontSize: 18, color: wmColor }}>Crescova</div>}
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
