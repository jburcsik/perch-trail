'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'

// Shared footer for all locale pages EXCEPT:
//  - the home page (which has its own footer with the contact form), and
//  - the map (full-screen, no footer).
// It mirrors the home footer minus the contact form.
export function SiteFooter() {
  const t = useTranslations('HomePage')
  const pathname = usePathname()

  if (pathname === '/' || pathname === '/map' || pathname.startsWith('/map/')) return null

  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl">
          <h3 className="text-3xl font-bold mb-6">{t('aboutTheTrail')}</h3>
          <p className="text-gray-300 mb-6 leading-relaxed text-lg">{t('footerDescription')}</p>
          <div className="flex flex-col gap-3">
            <Link href="/get-involved" className="text-amber-400 hover:text-amber-300 font-semibold text-lg transition-colors">
              {t('participate')}
            </Link>
            <Link href="/support" className="text-amber-400 hover:text-amber-300 font-semibold text-lg transition-colors">
              {t('supportTrail')} &rarr;
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
