import { ImageResponse } from '@vercel/og'

interface SlideOpts {
  content: string
  topic: string
  niche: string
  displayName: string
  plan: 'free' | 'pro'
  brandColor?: string
}

// Split post content into logical slides
function splitIntoSlides(content: string, topic: string): string[] {
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  const slides: string[] = []

  // Slide 1: Hook (first line)
  if (lines.length > 0) slides.push(lines[0])

  // Middle slides: group by sections (double newline) or individual points
  const body = content.split(/\n\s*\n/).map((s) => s.trim()).filter((s) => s.length > 0)
  // Skip first section (already used as hook), take body sections
  for (let i = 1; i < body.length && slides.length < 9; i++) {
    const section = body[i]
    // If section is short enough, use as one slide
    if (section.length <= 200) {
      slides.push(section)
    } else {
      // Split long sections into individual lines
      const sectionLines = section.split('\n').map((l) => l.trim()).filter((l) => l.length > 10)
      for (const line of sectionLines) {
        if (slides.length >= 9) break
        slides.push(line.slice(0, 200))
      }
    }
  }

  // Ensure minimum 3 slides (pad with topic if needed)
  while (slides.length < 2) {
    slides.push(topic)
  }

  return slides
}

function darkenHex(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16)
  const factor = 1 - percent / 100
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * factor))
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * factor))
  const b = Math.max(0, Math.round((num & 0xff) * factor))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * Generate carousel slides as an array of PNG Buffers.
 * Each slide is 1080×1080.
 */
export async function generateCarouselSlides(opts: SlideOpts): Promise<Buffer[]> {
  const { content, topic, niche, displayName, plan, brandColor } = opts
  const showWatermark = plan === 'free'
  const fontFamily = 'sans-serif'

  let from = brandColor ?? '#667eea'
  let to = brandColor ? darkenHex(brandColor, 25) : '#764ba2'

  const slideTexts = splitIntoSlides(content, topic)
  const buffers: Buffer[] = []

  for (let i = 0; i < slideTexts.length; i++) {
    const text = slideTexts[i]
    const isFirst = i === 0
    const isLast = i === slideTexts.length - 1

    // Slightly shift gradient per slide for visual variety
    const angle = 135 + (i * 15) % 45

    let jsx: React.ReactNode

    if (isFirst) {
      // Title slide
      jsx = (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: `linear-gradient(${angle}deg, ${from}, ${to})`, padding: '100px', fontFamily, justifyContent: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 4, marginBottom: 24 }}>{niche}</div>
          <div style={{ display: 'flex', fontSize: text.length > 80 ? 48 : 60, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{text.length > 150 ? text.slice(0, 147) + '…' : text}</div>
          <div style={{ display: 'flex', marginTop: 48, fontSize: 24, color: 'rgba(255,255,255,0.7)' }}>— {displayName}</div>
          <div style={{ display: 'flex', position: 'absolute', bottom: 40, right: 50, fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>Swipe →</div>
          {showWatermark && <div style={{ display: 'flex', position: 'absolute', bottom: 40, left: 50, fontSize: 16, color: 'rgba(255,255,255,0.25)' }}>Crescova</div>}
        </div>
      )
    } else if (isLast && slideTexts.length > 2) {
      // CTA slide
      jsx = (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: `linear-gradient(${angle}deg, ${from}, ${to})`, padding: '100px', fontFamily, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', fontSize: text.length > 100 ? 40 : 48, fontWeight: 600, color: 'white', textAlign: 'center', lineHeight: 1.3 }}>{text.length > 200 ? text.slice(0, 197) + '…' : text}</div>
          <div style={{ display: 'flex', marginTop: 48, fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>Follow {displayName} for more</div>
          <div style={{ display: 'flex', position: 'absolute', bottom: 40, fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>{i + 1} / {slideTexts.length}</div>
          {showWatermark && <div style={{ display: 'flex', position: 'absolute', bottom: 40, left: 50, fontSize: 16, color: 'rgba(255,255,255,0.25)' }}>Crescova</div>}
        </div>
      )
    } else {
      // Content slide
      jsx = (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: `linear-gradient(${angle}deg, ${from}, ${to})`, padding: '100px', fontFamily, justifyContent: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 32, flexShrink: 0 }}>{i}</div>
          <div style={{ display: 'flex', fontSize: text.length > 120 ? 36 : 44, fontWeight: 600, color: 'white', lineHeight: 1.35 }}>{text.length > 250 ? text.slice(0, 247) + '…' : text}</div>
          <div style={{ display: 'flex', position: 'absolute', bottom: 40, right: 50, fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>{i + 1} / {slideTexts.length}</div>
          {showWatermark && <div style={{ display: 'flex', position: 'absolute', bottom: 40, left: 50, fontSize: 16, color: 'rgba(255,255,255,0.25)' }}>Crescova</div>}
        </div>
      )
    }

    const response = new ImageResponse(jsx, {
      width: 1080,
      height: 1080,
    })

    const arrayBuffer = await response.arrayBuffer()
    buffers.push(Buffer.from(arrayBuffer))
  }

  return buffers
}
