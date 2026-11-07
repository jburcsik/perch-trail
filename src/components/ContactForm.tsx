'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import toast, { Toaster } from 'react-hot-toast'
import { trackFormSuccess } from '@/lib/analytics'

type Role = 'volunteer' | 'donor' | 'host' | 'artist' | 'creative' | 'unassigned' | 'birdhouse' | 'perch'

interface ContactFormProps {
  /** Show the role selector above the form. Defaults to true. */
  showRoleSelector?: boolean
  /** Pre-select a role */
  initialRole?: Role
  title?: string
  /** Visual variant: 'dark' for dark backgrounds like the footer */
  variant?: 'light' | 'dark'
  /** Prepended to the message on submit (e.g. "Pledge: $25"); lets a host
   * page attach structured context without owning the form. */
  messagePrefix?: string
  /** Whether the message field is required. Defaults to true. */
  messageRequired?: boolean
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export function ContactForm({ showRoleSelector = true, initialRole = 'unassigned', title, variant = 'light', messageRequired = true, messagePrefix }: ContactFormProps) {
  const isDark = variant === 'dark'
  const t = useTranslations('ContactForm')
  const [role, setRole] = useState<Role>(initialRole)
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  const starterMessages: Record<Exclude<Role, 'unassigned'>, string> = {
    volunteer:  t('volunteerStarter'),
    donor:      t('donorStarter'),
    host:       t('hostStarter'),
    artist:     t('artistStarter'),
    creative:   t('creativeStarter'),
    birdhouse:  '',
    perch:      '',
  }

  // The get-involved roles point back to the map after submitting.
  const exploreMapCopy: Partial<Record<Role, string>> = {
    birdhouse: t('exploreMapBirdhouse'),
    perch:     t('exploreMapPerch'),
    host:      t('exploreMapHost'),
    volunteer: t('exploreMapVolunteer'),
  }

  const roles: { value: Exclude<Role, 'unassigned' | 'creative'>; label: string; icon: string }[] = [
    { value: 'volunteer', label: t('volunteerLabel'), icon: '\u{1F64C}' },
    { value: 'donor',     label: t('donorLabel'),     icon: '\u{1F49B}' },
    { value: 'host',      label: t('hostLabel'),      icon: '\u{1F4CD}' },
    { value: 'artist',    label: t('artistLabel'),    icon: '\u{1F3A8}' },
  ]

  const selectRole = (value: Exclude<Role, 'unassigned'>) => {
    setRole(value)
    setForm(p => ({ ...p, message: starterMessages[value] }))
    setTimeout(() => {
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      nameRef.current?.focus()
    }, 50)
  }

  const formTitleMap: Record<Exclude<Role, 'unassigned'>, string> = {
    volunteer:  t('aboutVolunteering'),
    donor:      t('aboutDonating'),
    host:       t('aboutHosting'),
    creative:   t('aboutCreative'),
    artist:     t('aboutArtist'),
    birdhouse:  t('birdhouseFormTitle'),
    perch:      t('perchFormTitle'),
  }

  // Explicit title prop always wins (even empty string to suppress heading)
  const formTitle = title !== undefined
    ? title
    : role === 'unassigned'
      ? t('defaultTitle')
      : formTitleMap[role]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      toast.error(t('verificationRequired'))
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          role,
          // Prefix only when there is content; the category already carries the role.
          message: (() => {
            const composed = [messagePrefix, form.message.trim()].filter(Boolean).join(' ')
            return role !== 'unassigned' && composed ? `[${role.toUpperCase()}] ${composed}` : composed
          })(),
          website: honeypot,
          turnstileToken,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
        trackFormSuccess('contact', { role })
      } else {
        toast.error(t('somethingWrong'))
        turnstileRef.current?.reset()
        setTurnstileToken(null)
      }
    } catch {
      toast.error(t('networkError'))
      turnstileRef.current?.reset()
      setTurnstileToken(null)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    const mapCopy = exploreMapCopy[role]
    return (
      <div className="py-12 text-center">
        <div className="text-8xl mb-5">&#10084;&#65039;</div>
        <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-700'}`}>{t('messageReceived')}</p>
        <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('inTouchSoon')}</p>
        {mapCopy && (
          <div className="mt-6" data-testid="explore-map-cta">
            <p className={`mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{mapCopy}</p>
            <Link
              href="/map"
              className={`inline-block rounded-full px-6 py-2.5 font-semibold transition-colors ${
                isDark
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {t('exploreMapLinkLabel')}
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {showRoleSelector && (
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-4 text-center">{t('rolePrompt')}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {roles.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => selectRole(r.value)}
                className={`text-start p-4 rounded-2xl border-2 transition-all duration-200 ${
                  role === r.value
                    ? 'border-amber-500 bg-amber-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-amber-300 hover:shadow-sm'
                }`}
              >
                <span className="text-2xl me-2">{r.icon}</span>
                <span className="font-bold text-gray-900 text-sm">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {formTitle && <h3 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>{formTitle}</h3>}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Honeypot. sr-only rather than an off-canvas offset, which breaks RTL scroll. */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            type="text"
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
          />
        </div>

        <Input
          ref={nameRef}
          name="name"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder={t('namePlaceholder')}
          required
          className={isDark ? 'bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-lg py-3' : undefined}
        />
        <Input
          name="email"
          type="email"
          value={form.email}
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
          placeholder={t('emailPlaceholder')}
          required
          className={isDark ? 'bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-lg py-3' : undefined}
        />
        <Textarea
          name="message"
          value={form.message}
          onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
          placeholder={messageRequired ? t('messagePlaceholder') : t('messagePlaceholderOptional')}
          rows={4}
          required={messageRequired}
          className={isDark ? 'bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-lg' : undefined}
        />

        {TURNSTILE_SITE_KEY && (
          <Turnstile
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
            options={{ theme: isDark ? 'dark' : 'light', size: 'flexible' }}
          />
        )}

        <Button
          type="submit"
          disabled={submitting || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full py-3 font-semibold text-lg disabled:opacity-50"
        >
          {submitting ? t('sending') : t('sendMessage')}
        </Button>
      </form>
      <Toaster position="bottom-right" />
    </div>
  )
}
