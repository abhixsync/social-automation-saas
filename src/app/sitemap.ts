import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crescova.app'
  const now = new Date()
  return [
    { url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${url}/auth/signup`, lastModified: now, changeFrequency: 'yearly', priority: 0.8 },
    { url: `${url}/auth/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
  ]
}
