'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { bannerEvent } from '@/content/events'

// Site-wide banner for the event flagged `banner: true` in src/content/events.ts.
// Publishes its height as --event-banner-h so the fixed map layout can offset it.

// Written by this component only; it renders once, in the locale layout.
const BANNER_H_VAR = '--event-banner-h'

export function EventBanner() {
  const t = useTranslations('EventBanner')
  const ref = useRef<HTMLAnchorElement | null>(null)
  // Render nothing on the server/first paint so the date check never causes a
  // hydration mismatch on statically-cached pages.
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(bannerEvent(new Date()) !== null)
  }, [])

  // Publish the banner's real height (it wraps to two lines on narrow
  // screens) and zero it whenever the banner is hidden or unmounts.
  useEffect(() => {
    const root = document.documentElement
    if (!show || !ref.current) {
      root.style.setProperty(BANNER_H_VAR, '0px')
      return
    }
    const el = ref.current
    const publish = () => root.style.setProperty(BANNER_H_VAR, `${el.offsetHeight}px`)
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty(BANNER_H_VAR, '0px')
    }
  }, [show])

  if (!show) return null

  return (
    <Link
      ref={ref}
      href="/events"
      data-testid="event-banner"
      className="block bg-gradient-to-r from-amber-600 to-orange-600 text-white text-center text-sm sm:text-base font-semibold px-4 py-2.5 hover:from-amber-700 hover:to-orange-700 transition-colors"
    >
      {t('message')} <span aria-hidden="true">&rarr;</span>
    </Link>
  )
}
