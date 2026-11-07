import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/env'

// Everything is crawlable except the admin panel and the API.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Bare paths: disallow matching is prefix-based, so '/admin' covers the
      // dashboard root and its subtree, where '/admin/' would miss the root.
      disallow: ['/admin', '/api'],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
