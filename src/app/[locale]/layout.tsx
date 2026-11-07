import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getMessages, getTranslations } from 'next-intl/server'
import { NextIntlClientProvider } from 'next-intl'
import { routing } from '@/i18n/routing'
import { getPathname } from '@/i18n/navigation'
import { siteUrl } from '@/lib/env'
import { Nav } from '@/components/Nav'
import { SiteFooter } from '@/components/SiteFooter'
import { EventBanner } from '@/components/EventBanner'

// Strips a leading locale segment (for example '/ar/map' to '/map') so the route can
// be re-localized per target locale below. 'as-needed' prefixing means the
// default locale's pages have no segment to strip.
const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`)

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  // hreflang cluster for every public page, keyed to the *current*
  // route, not just the homepage. The current pathname isn't otherwise
  // available in generateMetadata, so middleware.ts forwards it as a header.
  const headerList = await headers()
  const pathname = headerList.get('x-pathname') ?? '/'
  const route = pathname.replace(LOCALE_PREFIX, '') || '/'

  const base = siteUrl()
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${base}${getPathname({ href: route, locale: l })}`])
  )
  languages['x-default'] = `${base}${getPathname({ href: route, locale: routing.defaultLocale })}`

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      languages,
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <EventBanner />
      <Nav />
      {children}
      <SiteFooter />
    </NextIntlClientProvider>
  )
}
