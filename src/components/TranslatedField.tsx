'use client'

import { useLocale, useTranslations } from 'next-intl'
import { resolveHouseContent } from '@/lib/translation'

/**
 * Renders one translatable house field (bio / artist_bio) for the current
 * viewer, applying the single resolver rule:
 *   - viewer's locale == source:     original text, no note
 *   - a translation exists:          translation + "robots translated this" note
 *   - no translation yet (lag):      original text + "shown in original language" note
 *
 * `sourceText` is the canonical houses.<field>; `translatedText` is the row from
 * house_translations for the current locale (or null). Renders nothing if there's
 * no source text.
 */
export function TranslatedField({
  sourceLocale,
  sourceText,
  translatedText,
  className,
  testId,
}: {
  sourceLocale: string | null | undefined
  sourceText: string | null | undefined
  translatedText?: string | null
  className?: string
  testId?: string
}) {
  const viewLocale = useLocale()
  const t = useTranslations('TranslationNote')
  const resolved = resolveHouseContent({ viewLocale, sourceLocale, sourceText, translatedText })
  if (!resolved) return null

  return (
    <>
      <p className={className} data-testid={testId}>{resolved.text}</p>
      {resolved.state !== 'source' && (
        <p className="mt-1 text-xs italic text-gray-400">
          {resolved.state === 'translated' ? t('autoTranslated') : t('originalLanguage')}
        </p>
      )}
    </>
  )
}
