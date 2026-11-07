import { getTranslations } from 'next-intl/server'
import { PERCH_UPDATES, sortNewestFirst, CONTENT_LOCALES, type Locale } from '@/content/perch-updates'
import { PerchUpdateCard } from '@/components/PerchUpdateCard'

function isContentLocale(value: string): value is Locale {
  return (CONTENT_LOCALES as readonly string[]).includes(value)
}

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  // News entries are hand-authored per locale, separate from the UI
  // message catalog. A locale without posts falls back to en like
  // any other locale this content hasn't been written for.
  const locale: Locale = isContentLocale(rawLocale) ? rawLocale : 'en'
  const t = await getTranslations('NewsPage')

  const posts = sortNewestFirst(PERCH_UPDATES)

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white py-16 shadow-xl">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl opacity-90 max-w-xl mx-auto">{t('subtitle')}</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-2xl space-y-8">
        {posts.length === 0 ? (
          <p className="text-center text-gray-500 py-12">{t('emptyState')}</p>
        ) : (
          posts.map((post) => <PerchUpdateCard key={post.slug} post={post} locale={locale} />)
        )}
      </div>
    </div>
  )
}
