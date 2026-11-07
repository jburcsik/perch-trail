'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ContactForm } from '@/components/ContactForm'
import { trackSelectContent } from '@/lib/analytics'

type CardId = 'birdhouse' | 'perch' | 'host' | 'volunteer'

const VALID_IDS = new Set<string>(['birdhouse', 'perch', 'host', 'volunteer'])

export default function GetInvolvedPage() {
  const t = useTranslations('GetInvolvedPage')
  const searchParams = useSearchParams()
  const [open, setOpen] = useState<CardId | null>(null)

  const CARDS: { id: CardId; title: string; description: string }[] = [
    { id: 'birdhouse', title: t('cardBirdhouseTitle'), description: t('cardBirdhouseDescription') },
    { id: 'perch', title: t('cardPerchTitle'), description: t('cardPerchDescription') },
    { id: 'host', title: t('cardHostTitle'), description: t('cardHostDescription') },
    { id: 'volunteer', title: t('cardVolunteerTitle'), description: t('cardVolunteerDescription') },
  ]
  const activeCard = CARDS.find(c => c.id === open) ?? null

  // Auto-open from ?open= query param (e.g. from homepage "Host a birdhouse" link)
  useEffect(() => {
    const param = searchParams.get('open')
    if (param && VALID_IDS.has(param)) setOpen(param as CardId)
  }, [searchParams])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white py-16 shadow-xl">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl opacity-90 max-w-xl mx-auto">
            {t('heroSubtitle')}
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="grid sm:grid-cols-2 gap-6">
          {CARDS.map((card) => (
            <button
              key={card.id}
              onClick={() => {
                trackSelectContent('get_involved_card', card.id)
                setOpen(card.id)
              }}
              className="text-start p-8 rounded-3xl border-2 border-gray-200 bg-white shadow-md hover:border-amber-300 hover:shadow-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-1">{card.title}</h2>
              <p className="text-gray-500 text-sm leading-relaxed">{card.description}</p>
              <p className="mt-4 text-sm font-semibold text-amber-500">{t('cardCta')}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Focused form overlay */}
      {open && activeCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40"
          onClick={() => setOpen(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative"
            style={{ animation: 'fadeIn 0.18s ease both' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(null)}
              aria-label={t('closeModal')}
              className="absolute top-4 end-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors text-sm font-bold"
            >
              &#10005;
            </button>

            <div className="p-8 pt-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{activeCard.title}</h2>
              <p className="text-sm text-gray-500 mb-6">{activeCard.description}</p>
              <ContactForm
                showRoleSelector={false}
                initialRole={activeCard.id}
                messageRequired={false}
                title=""
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
