/**
 * Text direction for a locale from the platform's own `Intl.Locale` data,
 * instead of a hand-rolled lookup table. Older runtimes expose it as the
 * `textInfo` getter; newer V8 (Node 22+) as a `getTextInfo()` method.
 */
type LocaleWithTextInfo = Intl.Locale & {
  textInfo?: { direction?: string }
  getTextInfo?: () => { direction?: string }
}

export function getLocaleDirection(locale: string): 'ltr' | 'rtl' {
  const l = new Intl.Locale(locale) as LocaleWithTextInfo
  const textInfo = typeof l.getTextInfo === 'function' ? l.getTextInfo() : l.textInfo
  return textInfo?.direction === 'rtl' ? 'rtl' : 'ltr'
}
