'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ContactForm } from '@/components/ContactForm'
import { trackCopyDonationAddress } from '@/lib/analytics'

// Three ways to give: a bank-transfer address (NEXT_PUBLIC_SUPPORT_ETRANSFER),
// a hosted card checkout link (NEXT_PUBLIC_SUPPORT_STRIPE_LINK), and a pledge
// sent as a donor-tagged inquiry, which is always on.
const ETRANSFER = process.env.NEXT_PUBLIC_SUPPORT_ETRANSFER
const STRIPE_LINK = process.env.NEXT_PUBLIC_SUPPORT_STRIPE_LINK

const AMOUNTS = ['5', '10', '25', '50'] as const

export default function SupportPage() {
  const t = useTranslations('SupportPage')
  const [copied, setCopied] = useState(false)
  const [amount, setAmount] = useState<string | null>(null)
  const [otherAmount, setOtherAmount] = useState('')

  // The pledge travels inside the inquiry message. Comma decimals normalise to
  // dots; anything unparseable travels as typed.
  const raw = otherAmount.trim()
  const normalized = raw.replace(',', '.').replace(/[^0-9.]/g, '')
  const chosen = amount === 'other' ? normalized : amount
  const pledgePrefix =
    chosen && Number(chosen) > 0 && /^\d+(\.\d{1,2})?$/.test(chosen)
      ? `Pledge: $${chosen}`
      : amount === 'other' && raw
        ? `Pledge (as typed): "${raw}"`
        : undefined

  const copyAddress = async () => {
    if (!ETRANSFER) return
    try {
      await navigator.clipboard.writeText(ETRANSFER)
      setCopied(true)
      trackCopyDonationAddress()
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard unavailable (permissions/insecure context): the address is
      // visible right beside the button, so failing quietly is fine.
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white py-16 shadow-xl">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl opacity-90 max-w-xl mx-auto">{t('subtitle')}</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-2xl space-y-8">
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100 text-center">
          <p className="text-lg text-gray-700 leading-relaxed">{t('impact')}</p>
          <p className="text-sm text-gray-500 mt-4">{t('honesty')}</p>
        </div>

        {ETRANSFER && (
          <div className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100" data-testid="etransfer-lane">
            <span className="inline-block bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1 rounded-full">&#128155; {t('etransferBadge')}</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-4">{t('etransferTitle')}</h2>
            <p className="mt-3 text-gray-600">{t('etransferBody')}</p>
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <code className="bg-amber-50 border border-amber-200 rounded-full px-4 py-2 text-amber-900 font-semibold">{ETRANSFER}</code>
              <button
                type="button"
                onClick={copyAddress}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-full px-5 py-2 transition-colors"
              >
                {copied ? t('copied') : t('copyAddress')}
              </button>
            </div>
          </div>
        )}

        {STRIPE_LINK && (
          <div className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100" data-testid="card-lane">
            <span className="inline-block bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1 rounded-full">&#128179; {t('cardBadge')}</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-4">{t('cardTitle')}</h2>
            <p className="mt-3 text-gray-600">{t('cardBody')}</p>
            <a
              href={STRIPE_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-full px-6 py-2.5 transition-colors"
            >
              {t('cardCta')}
            </a>
          </div>
        )}

        <div className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100" data-testid="support-ping">
          <h2 className="text-2xl font-bold text-gray-900">{t('pingTitle')}</h2>
          <p className="mt-2 mb-6 text-gray-600">{t('pingBody')}</p>

          <fieldset className="mb-6">
            <legend className="text-sm font-medium text-gray-900 mb-2">{t('amountLegend')}</legend>
            <div className="flex flex-wrap items-center gap-2">
              {AMOUNTS.map((a) => (
                <label
                  key={a}
                  data-testid={`amount-${a}`}
                  className={`cursor-pointer rounded-full border-2 px-5 py-2 font-semibold transition-colors focus-within:ring-2 focus-within:ring-amber-500 focus-within:ring-offset-1 ${amount === a ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600 hover:border-amber-300'}`}
                >
                  <input
                    type="radio"
                    name="pledge"
                    value={a}
                    checked={amount === a}
                    onChange={() => setAmount(a)}
                    className="sr-only"
                  />
                  ${a}
                </label>
              ))}
              <label
                data-testid="amount-other"
                className={`cursor-pointer rounded-full border-2 px-5 py-2 font-semibold transition-colors focus-within:ring-2 focus-within:ring-amber-500 focus-within:ring-offset-1 ${amount === 'other' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600 hover:border-amber-300'}`}
              >
                <input
                  type="radio"
                  name="pledge"
                  value="other"
                  checked={amount === 'other'}
                  onChange={() => setAmount('other')}
                  className="sr-only"
                />
                {t('amountOther')}
              </label>
              {amount === 'other' && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 font-semibold">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    data-testid="amount-other-input"
                    value={otherAmount}
                    onChange={(e) => setOtherAmount(e.target.value)}
                    placeholder={t('amountPlaceholder')}
                    className="w-24 rounded-full border-2 border-amber-300 px-4 py-2 font-semibold focus:outline-none focus:border-amber-500"
                    aria-label={t('amountLegend')}
                  />
                </div>
              )}
            </div>
          </fieldset>

          <ContactForm showRoleSelector={false} initialRole="donor" title="" messageRequired={false} messagePrefix={pledgePrefix} />
        </div>
      </div>
    </div>
  )
}
