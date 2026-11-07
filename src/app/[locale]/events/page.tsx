import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { upcomingEvents, pastEvents, type PerchEvent } from '@/content/events'

// Upcoming versus past depends on the clock, so the page revalidates hourly
// instead of being baked at build time.
export const revalidate = 3600

export default async function EventsPage() {
  const t = await getTranslations('EventsPage')

  // Upcoming and past are derived from the clock against src/content/events.ts.
  const now = new Date()
  const copy = (e: PerchEvent) => ({
    id: e.id,
    badge: t(`${e.id}Badge`),
    title: t(`${e.id}Title`),
    when: t(`${e.id}When`),
    where: t(`${e.id}Where`),
    description: t(`${e.id}Description`),
    directions: e.directions,
  })
  const upcoming = upcomingEvents(now).map(copy)
  const past = pastEvents(now).map(copy)

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white py-16 shadow-xl">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl opacity-90 max-w-xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-2xl space-y-8">
        <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold">{t('comingUp')}</p>
        {upcoming.map((e) => (
          <div key={e.id} className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100">
            <span className="inline-block bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1 rounded-full">
              {e.badge}
            </span>
            <h2 className="text-3xl font-bold text-gray-900 mt-4">{e.title}</h2>
            <div className="mt-4 space-y-1.5 text-gray-700">
              <p className="flex items-center gap-2 font-semibold"><span>&#128197;</span> {e.when}</p>
              <p className="flex items-center gap-2"><span>&#128205;</span> {e.where}</p>
            </div>
            <p className="mt-5 text-gray-600 leading-relaxed text-lg">{e.description}</p>
            {e.directions && (
            <a
              href={e.directions}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-full px-5 py-2.5 transition-colors"
            >
              &#128205; {t('directions')}
            </a>
            )}
          </div>
        ))}

        {/* Empty state under the "Coming up" heading. */}
        {upcoming.length === 0 && (
          <div className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100 text-center">
            <div className="text-4xl mb-4">&#127912;</div>
            <h2 className="text-2xl font-bold text-gray-900">{t('comingSoonTitle')}</h2>
            <p className="mt-3 text-gray-600 leading-relaxed">{t('comingSoonDescription')}</p>
          </div>
        )}

        {/* Past events: faded card with a rotated "Painted!" stamp. */}
        <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold pt-6">{t('storySoFar')}</p>
        {past.map((e) => (
          <div
            key={e.id}
            data-testid="past-event"
            className="relative overflow-hidden bg-white/70 rounded-3xl p-8 shadow-sm border border-gray-200"
          >
            {/* physical: intentional, a decorative rotated stamp, rotation angle is tied to this physical corner */}
            <div
              aria-hidden="true"
              className="absolute top-7 -right-9 rotate-[18deg] border-[3px] border-dashed border-[#C2452F]/50 text-[#C2452F]/60 font-extrabold uppercase tracking-[0.2em] text-sm px-10 py-1.5 rounded select-none pointer-events-none"
            >
              {t('paintedStamp')}
            </div>
            <div className="opacity-70 saturate-50">
              <span className="inline-block bg-gray-100 text-gray-500 text-sm font-semibold px-3 py-1 rounded-full">
                &#10003; {t('happenedBadge')}
              </span>
              <h2 className="text-3xl font-bold text-gray-700 mt-4">{e.title}</h2>
              <div className="mt-4 space-y-1.5 text-gray-500">
                <p className="flex items-center gap-2 font-semibold"><span>&#128197;</span> {e.when}</p>
                <p className="flex items-center gap-2"><span>&#128205;</span> {e.where}</p>
              </div>
              <p className="mt-5 text-gray-500 leading-relaxed">{e.description}</p>
            </div>
          </div>
        ))}

        {/* CTA */}
        <div className="text-center bg-white rounded-3xl p-10 shadow-lg border border-amber-100">
          <div className="text-4xl mb-4">&#128236;</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('wantToHost')}</h3>
          <p className="text-gray-600 mb-6">
            {t('wantToHostDescription')}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/get-involved">
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white px-10 rounded-full shadow-md">
                {t('getInvolved')}
              </Button>
            </Link>
            <Link href="/support" className="text-amber-700 font-semibold hover:underline">
              {t('supportCta')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
