import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.licdn.com https://*.public.blob.vercel-storage.com https://images.pexels.com https://lh3.googleusercontent.com; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self';",
  },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Prevent webpack from bundling @vercel/og so it can load its WASM binary
  // correctly in Node.js serverless functions (API routes that use generatePostImage)
  serverExternalPackages: ['@vercel/og'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.licdn.com',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
