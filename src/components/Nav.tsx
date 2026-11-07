'use client'

import { useLocale, useTranslations } from 'next-intl'
import NextLink from 'next/link'
import { Link, usePathname, getPathname } from '@/i18n/navigation'
import { useState, useRef, useEffect } from 'react'
import { trackLanguageSelect } from '@/lib/analytics'
import { LOCALES } from '@/i18n/locales'

export function Nav() {
  const t = useTranslations('Nav')
  const locale = useLocale()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const langMenuRef = useRef<HTMLDivElement>(null)

  // Top level: Map, the primary action, then Events. Below `sm` Events moves
  // into "More" so the row fits a phone width in every locale.
  const topLinks = [
    { key: 'map', href: '/map' as const, match: '/map', label: t('map'), className: '' },
    {
      key: 'birdhouse',
      href: { pathname: '/get-involved' as const, query: { open: 'birdhouse' } },
      match: '',
      label: t('requestBirdhouse'),
      className: '',
    },
    { key: 'events', href: '/events' as const, match: '/events', label: t('events'), className: 'hidden sm:inline-block' },
  ]
  const moreLinks = [
    // Events lives here only at the widths where it is not on the top level.
    { key: 'events', href: '/events' as const, match: '/events', label: t('events'), className: 'sm:hidden' },
    { key: 'getInvolved', href: '/get-involved' as const, match: '/get-involved', label: t('getInvolved'), className: '' },
    { key: 'news', href: '/news' as const, match: '/news', label: t('news'), className: '' },
    { key: 'faq', href: '/faq' as const, match: '/faq', label: t('faq'), className: '' },
    { key: 'support', href: '/support' as const, match: '/support', label: t('supportTrail'), className: '' },
  ]

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on route change (derived-state pattern, so it never flashes open)
  const [lastPathname, setLastPathname] = useState(pathname)
  if (lastPathname !== pathname) {
    setLastPathname(pathname)
    setOpen(false)
    setLangOpen(false)
  }

  if (pathname.startsWith('/admin')) return null

  const locales = LOCALES
  // Each language's own native name, never translated by the viewer's current locale.
  const langName: Record<string, string> = { en: 'English', fr: 'Fran\u{E7}ais', vi: 'Ti\u{1EBF}ng Vi\u{1EC7}t', 'zh-Hans': '\u{7B80}\u{4F53}\u{4E2D}\u{6587}', ar: '\u{627}\u{644}\u{639}\u{631}\u{628}\u{64A}\u{629}' }

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-amber-100 shadow-sm">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-amber-700 text-lg tracking-tight hover:text-amber-600 transition-colors">
          {t('brand')}
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Top-level links */}
          {topLinks.map(({ key, href, match, label, className }) => (
            <Link
              key={key}
              href={href}
              className={`text-sm font-medium px-2 py-1.5 rounded-md transition-colors ${className} ${
                pathname === match ? 'text-amber-700 bg-amber-50' : 'text-gray-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              {label}
            </Link>
          ))}

          {/* More dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-amber-700 px-2 py-1.5 rounded-md hover:bg-amber-50 transition-colors"
            >
              {t('more')}
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div className="absolute end-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-amber-100 py-2 z-50">
                {moreLinks.map(({ key, href, match, label, className }) => (
                  <Link
                    key={key}
                    href={href}
                    className={`block px-4 py-2.5 text-sm transition-colors ${className} ${
                      pathname === match ? 'text-amber-700 font-semibold bg-amber-50' : 'text-gray-700 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
                <div className="border-t border-gray-100 mt-2 pt-2">
                  <NextLink
                    href="/admin"
                    className="block px-4 py-2.5 text-sm text-gray-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                  >
                    {t('login')}
                  </NextLink>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-gray-200 mx-0.5" />

          {/* Language switcher: globe icon + dropdown, native-language labels */}
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => setLangOpen((o) => !o)}
              aria-label="Language"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-amber-700 px-2 py-1.5 rounded-md hover:bg-amber-50 transition-colors"
            >
              <span aria-hidden="true">&#127760;</span>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {langOpen && (
              <div role="listbox" className="absolute end-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-amber-100 py-2 z-50">
                {locales.map((loc) => (
                  // A full navigation, so the root layout re-renders <html lang> and dir.
                  // forcePrefix makes the middleware update the locale cookie before
                  // redirecting, so switching back to the default locale works.
                  <a
                    key={loc}
                    href={getPathname({ href: pathname, locale: loc, forcePrefix: true })}
                    role="option"
                    aria-selected={locale === loc}
                    onClick={() => { if (loc !== locale) trackLanguageSelect(loc) }}
                    className={`block px-4 py-2.5 text-sm transition-colors ${
                      locale === loc ? 'text-amber-700 font-semibold bg-amber-50' : 'text-gray-700 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    {langName[loc]}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
