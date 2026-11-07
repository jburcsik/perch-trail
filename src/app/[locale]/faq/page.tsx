'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'

const FAQ_COUNT = 11

// Render an answer string, turning [text](/path) markdown links into in-app links.
function renderAnswer(text: string) {
  return text.split(/(\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    return m ? (
      <Link key={i} href={m[2]} className="text-amber-700 font-medium underline underline-offset-2 hover:text-amber-800">
        {m[1]}
      </Link>
    ) : (
      part
    )
  })
}

export default function FAQPage() {
  const t = useTranslations('FAQPage')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({
    id: i + 1,
    question: t(`faq${i + 1}Question`),
    answer: t(`faq${i + 1}Answer`),
  }))

  const query = search.toLowerCase().trim()
  const filtered = query
    ? faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
      )
    : faqs

  const toggle = (id: number) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white py-16 shadow-xl">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl opacity-90 max-w-xl mx-auto">{t('subtitle')}</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Search bar */}
        <div className="mb-8">
          <div className="relative">
            <svg
              className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full ps-12 pe-4 py-3 rounded-full bg-white border border-amber-200 text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* FAQ accordion */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100 text-center">
              <p className="text-gray-500">{t('noResults')}</p>
            </div>
          ) : (
            filtered.map((faq) => {
              const isOpen = openId === faq.id
              return (
                <div
                  key={faq.id}
                  className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden"
                >
                  <button
                    onClick={() => toggle(faq.id)}
                    data-testid="faq-question"
                    className="w-full text-start px-6 py-5 flex items-center justify-between gap-4 hover:bg-amber-50/50 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-gray-900">
                      {faq.question}
                    </span>
                    <svg
                      className={`w-5 h-5 text-amber-600 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <div
                    className={`grid transition-all duration-200 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-5 text-gray-600 leading-relaxed">
                        {renderAnswer(faq.answer)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* CTA */}
        <div className="text-center mt-16 bg-white rounded-3xl p-10 shadow-lg border border-amber-100">
          <div className="text-4xl mb-4">&#128172;</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            {t('stillHaveQuestions')}
          </h3>
          <p className="text-gray-600 mb-6">
            {t('stillHaveQuestionsDescription')}
          </p>
          <Link href="/get-involved">
            <Button
              size="lg"
              className="bg-amber-600 hover:bg-amber-700 text-white px-10 rounded-full shadow-md"
            >
              {t('getInTouch')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
