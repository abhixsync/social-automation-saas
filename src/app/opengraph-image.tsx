import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Crescova — Automate Your LinkedIn Presence'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '60px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '36px' }}>
          {/* Inline SVG logo mark */}
          <svg width="80" height="80" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.15)" />
            <path
              d="M5 20 C8 20, 9 10, 12.5 10 C16 10, 17 30, 20 30 C23 30, 24 10, 27.5 10 C31 10, 32 20, 35 20"
              stroke="white"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span style={{ fontSize: '68px', fontWeight: 700, color: 'white', letterSpacing: '-2px' }}>
            Crescova
          </span>
        </div>
        <p
          style={{
            fontSize: '30px',
            color: 'rgba(255,255,255,0.85)',
            margin: '0',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.4,
          }}
        >
          Automate your LinkedIn presence with AI
        </p>
        <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.5)', marginTop: '20px' }}>
          Schedule · Generate · Publish — on autopilot
        </p>
      </div>
    ),
    { ...size }
  )
}
