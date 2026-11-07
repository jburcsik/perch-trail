'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import toast, { Toaster } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { trackFormSuccess } from '@/lib/analytics'
import { SITE_URL_DEFAULT } from '@/config/site'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export function RecoverForm() {
  const t = useTranslations('RecoverForm')
  const [profileUrl, setProfileUrl] = useState('')
  const [email, setEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const turnstileRef = useRef<TurnstileInstance>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!profileUrl.trim() || !email.trim()) {
      toast.error(t('fillBothFields'))
      return
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      toast.error(t('verificationFailed'))
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl, email, turnstileToken }),
      })
      if (res.status === 429) {
        toast.error(t('rateLimited'))
        return
      }
      // Either success or "no match": both return the neutral response
      setSubmitted(true)
      trackFormSuccess('recover')
    } catch {
      toast.error(t('networkError'))
      turnstileRef.current?.reset()
      setTurnstileToken(null)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="py-10 text-center" data-testid="recover-thanks">
        <div className="text-5xl mb-4">&#128236;</div>
        <p className="text-xl font-semibold text-gray-800">
          {t('successTitle')}
        </p>
        <p className="mt-2 text-gray-600 max-w-md mx-auto">
          {t('successSubtitle')}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="recover-form">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('profileUrlLabel')}</label>
        <Input
          name="profileUrl"
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder={`${SITE_URL_DEFAULT}/h/ABC12`}
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          {t('profileUrlHint')}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailLabel')}</label>
        <Input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          required
        />
      </div>

      {TURNSTILE_SITE_KEY && (
        <Turnstile
          ref={turnstileRef}
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          options={{ size: 'flexible' }}
        />
      )}

      <Button
        type="submit"
        disabled={submitting || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
        className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full py-3 font-semibold text-lg disabled:opacity-50"
      >
        {submitting ? t('sending') : t('submit')}
      </Button>

      <Toaster position="bottom-right" />
    </form>
  )
}
