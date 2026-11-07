// Translation pipeline shared types + helpers.
// Source of truth for what's translatable, which locales are targets, and
// how source_ref strings encode "what does this row translate."
//
// Read-time, change-detection, and producer/consumer code all import from
// here so adding a new translatable field or a new target locale is one diff.

import { createHash } from 'crypto'
import { LOCALES, NON_DEFAULT_LOCALES, type Locale, type NonDefaultLocale } from '@/i18n/locales'

/** Locales that get translated content. The default locale is excluded. */
export const TRANSLATION_TARGET_LOCALES = NON_DEFAULT_LOCALES
export type TargetLocale = NonDefaultLocale

/** Every locale the site renders, derived from src/i18n/locales.ts. */
export const SUPPORTED_LOCALES = LOCALES
export type SupportedLocale = Locale

/** Narrowing guard for untrusted locale input (request bodies, params). */
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Locales a house field should be translated into: every supported locale
 * except the field's own source language. Mirrors the enqueue trigger
 * (migration 020). An unsupported or unknown source falls back to 'en'.
 */
export function translationTargetsForSource(sourceLocale: string | null | undefined): SupportedLocale[] {
  const src = isSupportedLocale(sourceLocale) ? sourceLocale : 'en'
  return SUPPORTED_LOCALES.filter((loc) => loc !== src)
}

/** Translatable fields on `houses`. Adding one here also requires extending
 *  the Postgres trigger in supabase/migrations/202601010000012_translation_queue.sql. */
export const HOUSE_TRANSLATABLE_FIELDS = ['artist_bio', 'bio'] as const
export type HouseTranslatableField = typeof HOUSE_TRANSLATABLE_FIELDS[number]

/** Stable hash of any source string (UI key value or house field). */
export function sourceHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

// source_ref encoding
// Compact strings the queue can store and the importer can route on.
//   houses:<qr_code_id>:<field>     house field translation
//   messages:<dotted.key.path>      UI string in src/messages/*.json

export function houseFieldRef(qrCodeId: string, field: HouseTranslatableField): string {
  return `houses:${qrCodeId}:${field}`
}

export function messageKeyRef(dottedKey: string): string {
  return `messages:${dottedKey}`
}

export type ParsedRef =
  | { kind: 'house_field'; qrCodeId: string; field: HouseTranslatableField }
  | { kind: 'message_key'; key: string }
  | { kind: 'unknown' }

// Read-time overlay: surfaces that list houses render translated text over the source rows.

/**
 * How a single house field should be rendered for one viewer:
 *   'source':          viewer's locale IS the author's language; show canonical text, no note
 *   'translated':      a translation exists; show it with the auto-translation disclaimer
 *   'source_fallback': no translation yet (pipeline lag); show the original + "original language" note
 */
export type HouseContentState = 'source' | 'translated' | 'source_fallback'
export interface ResolvedContent {
  text: string
  state: HouseContentState
}

/** The one rule for rendering a translatable house field for a viewer locale; null when there is no source text. */
export function resolveHouseContent(opts: {
  viewLocale: string
  sourceLocale: string | null | undefined
  sourceText: string | null | undefined
  translatedText: string | null | undefined
}): ResolvedContent | null {
  const sourceText = (opts.sourceText ?? '').trim() ? opts.sourceText! : null
  if (!sourceText) return null
  const sourceLocale = isSupportedLocale(opts.sourceLocale) ? opts.sourceLocale : 'en'
  if (opts.viewLocale === sourceLocale) return { text: sourceText, state: 'source' }
  const tx = (opts.translatedText ?? '').trim()
  if (tx) return { text: opts.translatedText!, state: 'translated' }
  return { text: sourceText, state: 'source_fallback' }
}

export function parseSourceRef(ref: string): ParsedRef {
  if (ref.startsWith('houses:')) {
    const rest = ref.slice('houses:'.length)
    const idx = rest.lastIndexOf(':')
    if (idx <= 0) return { kind: 'unknown' }
    const qrCodeId = rest.slice(0, idx)
    const field = rest.slice(idx + 1) as HouseTranslatableField
    if (!HOUSE_TRANSLATABLE_FIELDS.includes(field)) return { kind: 'unknown' }
    return { kind: 'house_field', qrCodeId, field }
  }
  if (ref.startsWith('messages:')) {
    return { kind: 'message_key', key: ref.slice('messages:'.length) }
  }
  return { kind: 'unknown' }
}
