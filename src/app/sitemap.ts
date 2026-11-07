import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { serviceClient } from '@/lib/supabase-admin'
import { siteUrl } from '@/lib/env'

// Static public routes. Excludes admin, api, and the token-gated
// preview/recover/v flows; those aren't meant to be indexed.
const STATIC_ROUTES = [
  '',
  '/privacy',
  '/faq',
  '/get-involved',
  '/terms',
  '/map',
  '/news',
  '/support',
  '/volunteer',
  // '/request' is a client-side redirect, so it is not advertised.
  '/events',
]

// routing.localePrefix is 'as-needed': the default locale gets no prefix,
// every other locale is prefixed with its code.
function localizedPath(locale: string, path: string): string {
  return locale === routing.defaultLocale ? path || '/' : `/${locale}${path}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const entries: MetadataRoute.Sitemap = []

  for (const path of STATIC_ROUTES) {
    entries.push({
      url: `${base}${localizedPath(routing.defaultLocale, path)}`,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((locale) => [locale, `${base}${localizedPath(locale, path)}`])
        ),
      },
    })
  }

  // Live house pages. This runs at build time, so an unreachable database
  // degrades to the static routes instead of failing the build.
  let houses: { qr_code_id: string; slug: string | null }[] | null = null
  try {
    const { data, error } = await serviceClient()
      .from('houses')
      .select('qr_code_id, slug')
      .eq('status', 'live')
      .is('archived_at', null)
    if (error) throw error
    houses = data
  } catch (e) {
    console.error('[sitemap] house pages omitted, Supabase unavailable at build:', (e as Error).message)
  }

  for (const house of houses ?? []) {
    const id = house.slug ?? house.qr_code_id
    entries.push({
      url: `${base}${localizedPath(routing.defaultLocale, `/h/${id}`)}`,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((locale) => [locale, `${base}${localizedPath(locale, `/h/${id}`)}`])
        ),
      },
    })
  }

  return entries
}
