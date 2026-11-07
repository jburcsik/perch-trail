// Locale-parity guardrail for next-intl message files.
//
// English (en.json) is the source of truth. Every target locale must define the
// exact same set of leaf keys; a key present only in en renders as a raw path.
//
// `missing` / `extra` keys are ERRORS (they break the UI). `untranslated`
// (value identical to English, minus the allowlist) is a WARNING, surfaced so
// translation gaps are visible without blocking a deploy on proper nouns.

import { NON_DEFAULT_LOCALES, type NonDefaultLocale } from '@/i18n/locales'
import { z } from 'zod'
import { walkMessages, getByPath } from './messages-walk'
import en from '../messages/en.json'
import fr from '../messages/fr.json'
import vi from '../messages/vi.json'
import zhHans from '../messages/zh-Hans.json'
import ar from '../messages/ar.json'

export const SOURCE_LOCALE = 'en'
export const TARGET_LOCALES = NON_DEFAULT_LOCALES
export type TargetLocale = NonDefaultLocale

const MESSAGES: Record<string, unknown> = { en, fr, vi, 'zh-Hans': zhHans, ar }

// Keys intentionally identical to English: brand, proper nouns, language codes,
// placeholders. These are exempt from the "untranslated" warning.
export const UNTRANSLATED_ALLOWLIST = new Set<string>([
  'Metadata.title',
  'Nav.brand',
  'Nav.menu',
  'Nav.faq',
  'Nav.switchToFrench',
  'Nav.switchToEnglish',
  'HomePage.heroTitle',
  'HomePage.heroTitleAccent',
  'HousePage.slugPlaceholder',
  'HousePage.tags',
  'ViewPage.photo',
])

// A message file is a tree whose leaves are non-empty strings.
const messageNode: z.ZodType = z.lazy(() =>
  z.union([z.string().min(1), z.record(z.string(), messageNode)])
)
export const messageFileSchema = z.record(z.string(), messageNode)

export type LocaleReport = {
  locale: string
  missing: string[]
  extra: string[]
  untranslated: string[]
  emptyLeaves: string[]
}

export function checkLocale(locale: TargetLocale): LocaleReport {
  const source = MESSAGES[SOURCE_LOCALE]
  const target = MESSAGES[locale]

  const enLeaves = walkMessages(source)
  const targetLeaves = walkMessages(target)
  const targetKeys = new Set(targetLeaves.map((l) => l.key))
  const enKeys = new Set(enLeaves.map((l) => l.key))

  const missing = enLeaves.map((l) => l.key).filter((k) => !targetKeys.has(k))
  const extra = targetLeaves.map((l) => l.key).filter((k) => !enKeys.has(k))

  const untranslated: string[] = []
  for (const { key, value } of enLeaves) {
    if (!targetKeys.has(key) || UNTRANSLATED_ALLOWLIST.has(key)) continue
    const tv = getByPath(target, key)
    if (typeof tv === 'string' && tv === value && /\p{L}/u.test(value) && value.trim().length > 2) {
      untranslated.push(key)
    }
  }

  const emptyLeaves = targetLeaves.filter((l) => l.value.trim() === '').map((l) => l.key)

  return { locale, missing, extra, untranslated, emptyLeaves }
}

export function checkAllLocales(): LocaleReport[] {
  return TARGET_LOCALES.map(checkLocale)
}

/** Blocking issues = anything that breaks the rendered UI. */
export function hasBlockingIssues(reports: LocaleReport[]): boolean {
  return reports.some((r) => r.missing.length > 0 || r.extra.length > 0 || r.emptyLeaves.length > 0)
}

/** Validate that every locale file is a tree of non-empty string leaves. */
export function validateShapes(): { locale: string; error: string }[] {
  const errors: { locale: string; error: string }[] = []
  for (const locale of [SOURCE_LOCALE, ...TARGET_LOCALES]) {
    const result = messageFileSchema.safeParse(MESSAGES[locale])
    if (!result.success) errors.push({ locale, error: result.error.issues[0]?.message ?? 'invalid shape' })
  }
  return errors
}
