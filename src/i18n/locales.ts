// The one list of the site's locales. This file imports nothing so the Jest
// suites can load it; every other locale list in the codebase derives from it.

export const LOCALES = ['en', 'fr', 'vi', 'zh-Hans', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'
export type NonDefaultLocale = Exclude<Locale, 'en'>

/** Every locale except the default: the translation targets. */
export const NON_DEFAULT_LOCALES = LOCALES.filter(
  (l): l is NonDefaultLocale => l !== DEFAULT_LOCALE
)

/** Narrowing guard for untrusted locale input (request bodies, route params). */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}
