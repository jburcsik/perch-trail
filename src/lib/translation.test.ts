/**
 * @jest-environment node
 */
import { sourceHash, houseFieldRef, messageKeyRef, parseSourceRef, resolveHouseContent, isSupportedLocale, translationTargetsForSource, SUPPORTED_LOCALES, TRANSLATION_TARGET_LOCALES } from './translation'

describe('sourceHash', () => {
  it('is stable for identical input', () => {
    expect(sourceHash('hello')).toBe(sourceHash('hello'))
  })
  it('changes when input changes by a single character', () => {
    expect(sourceHash('hello')).not.toBe(sourceHash('Hello'))
  })
})

describe('source_ref encoding', () => {
  it('round-trips a house field ref', () => {
    const ref = houseFieldRef('ABCDE', 'bio')
    expect(parseSourceRef(ref)).toEqual({ kind: 'house_field', qrCodeId: 'ABCDE', field: 'bio' })
  })

  it('handles qr_code_ids that contain colons', () => {
    // The parser splits on the last colon.
    const ref = houseFieldRef('AB:CDE', 'artist_bio')
    expect(parseSourceRef(ref)).toEqual({ kind: 'house_field', qrCodeId: 'AB:CDE', field: 'artist_bio' })
  })

  it('round-trips a message key ref including dotted paths', () => {
    const ref = messageKeyRef('home.featured.title')
    expect(parseSourceRef(ref)).toEqual({ kind: 'message_key', key: 'home.featured.title' })
  })

  it('rejects unknown shapes', () => {
    expect(parseSourceRef('whatever:foo')).toEqual({ kind: 'unknown' })
  })

  it('rejects unknown field names on house refs', () => {
    expect(parseSourceRef('houses:ABCDE:secret_field')).toEqual({ kind: 'unknown' })
  })
})

describe('isSupportedLocale', () => {
  it('accepts every supported locale', () => {
    for (const loc of SUPPORTED_LOCALES) expect(isSupportedLocale(loc)).toBe(true)
  })
  it('includes en plus the translation targets', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(['ar', 'en', 'fr', 'vi', 'zh-Hans'])
  })
  it('rejects unknown / malformed input', () => {
    for (const bad of ['', 'EN', 'zh', 'zh-Hant', 'de', null, undefined, 42, {}]) {
      expect(isSupportedLocale(bad)).toBe(false)
    }
  })
})

describe('translationTargetsForSource', () => {
  it('English source targets every other locale', () => {
    expect(translationTargetsForSource('en').sort()).toEqual(['ar', 'fr', 'vi', 'zh-Hans'])
  })
  it('Chinese source includes English, excludes zh-Hans', () => {
    const t = translationTargetsForSource('zh-Hans')
    expect(t).toContain('en')
    expect(t).not.toContain('zh-Hans')
    expect(t.sort()).toEqual(['ar', 'en', 'fr', 'vi'])
  })
  it('never targets the source locale, for every supported source', () => {
    for (const src of SUPPORTED_LOCALES) {
      expect(translationTargetsForSource(src)).not.toContain(src)
      expect(translationTargetsForSource(src)).toHaveLength(SUPPORTED_LOCALES.length - 1)
    }
  })
  it('unknown/null source falls back to en-source behavior', () => {
    expect(translationTargetsForSource(null).sort()).toEqual(['ar', 'fr', 'vi', 'zh-Hans'])
    expect(translationTargetsForSource('de').sort()).toEqual(['ar', 'fr', 'vi', 'zh-Hans'])
  })
})

describe('resolveHouseContent', () => {
  const base = { sourceText: 'Original text', sourceLocale: 'zh-Hans' as const }

  it('viewer locale == source gives canonical source, no note', () => {
    const r = resolveHouseContent({ ...base, viewLocale: 'zh-Hans', translatedText: '\u8bd1\u6587' })
    expect(r).toEqual({ text: 'Original text', state: 'source' })
  })
  it('other locale with a translation gives translated + disclaimer state', () => {
    const r = resolveHouseContent({ ...base, viewLocale: 'en', translatedText: 'English translation' })
    expect(r).toEqual({ text: 'English translation', state: 'translated' })
  })
  it('other locale without a translation gives original + fallback note state', () => {
    const r = resolveHouseContent({ ...base, viewLocale: 'en', translatedText: null })
    expect(r).toEqual({ text: 'Original text', state: 'source_fallback' })
  })
  it('blank/whitespace translation is treated as missing', () => {
    const r = resolveHouseContent({ ...base, viewLocale: 'fr', translatedText: '   ' })
    expect(r?.state).toBe('source_fallback')
  })
  it('no source text gives null (render nothing)', () => {
    expect(resolveHouseContent({ viewLocale: 'en', sourceLocale: 'en', sourceText: null, translatedText: null })).toBeNull()
    expect(resolveHouseContent({ viewLocale: 'en', sourceLocale: 'en', sourceText: '  ', translatedText: 'x' })).toBeNull()
  })
  it('unsupported/null source locale falls back to en-source', () => {
    // en viewer + en-source (defaulted) shows source, no note
    expect(resolveHouseContent({ viewLocale: 'en', sourceLocale: null, sourceText: 'Hi', translatedText: 'x' })?.state).toBe('source')
    // fr viewer + defaulted en-source + translation gives translated
    expect(resolveHouseContent({ viewLocale: 'fr', sourceLocale: 'de', sourceText: 'Hi', translatedText: 'Salut' })?.state).toBe('translated')
  })
  it('English-source house (the common case) reads naturally', () => {
    expect(resolveHouseContent({ viewLocale: 'en', sourceLocale: 'en', sourceText: 'Hi', translatedText: null })).toEqual({ text: 'Hi', state: 'source' })
    expect(resolveHouseContent({ viewLocale: 'zh-Hans', sourceLocale: 'en', sourceText: 'Hi', translatedText: '\u4f60\u597d' })).toEqual({ text: '\u4f60\u597d', state: 'translated' })
  })
})

describe('TRANSLATION_TARGET_LOCALES', () => {
  it('does not target the source locale', () => {
    expect(TRANSLATION_TARGET_LOCALES).not.toContain('en')
  })
  it('uses Simplified Chinese, never Traditional', () => {
    expect(TRANSLATION_TARGET_LOCALES).toContain('zh-Hans')
    expect(TRANSLATION_TARGET_LOCALES).not.toContain('zh-Hant')
    expect(TRANSLATION_TARGET_LOCALES).not.toContain('zh-TW')
  })
})

// Locale drift guard: every locale list derives from src/i18n/locales.ts and no
// module restates a literal list.
import { readFileSync } from 'fs'
import { LOCALES, NON_DEFAULT_LOCALES } from '@/i18n/locales'
import { CONTENT_LOCALES } from '@/content/perch-updates'
import { TARGET_LOCALES } from './messages-parity'

describe('locale list drift', () => {
  it('SUPPORTED_LOCALES derives from the shared list', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual([...LOCALES].sort())
  })

  it('TRANSLATION_TARGET_LOCALES is every locale except the default', () => {
    expect([...TRANSLATION_TARGET_LOCALES].sort()).toEqual([...NON_DEFAULT_LOCALES].sort())
  })

  it('CONTENT_LOCALES (news posts) derives from the shared list', () => {
    expect([...CONTENT_LOCALES].sort()).toEqual([...LOCALES].sort())
  })

  it('messages-parity TARGET_LOCALES derives from the shared list', () => {
    expect([...TARGET_LOCALES].sort()).toEqual([...NON_DEFAULT_LOCALES].sort())
  })

  it("accepts 'ar' as a supported locale", () => {
    expect(isSupportedLocale('ar')).toBe(true)
  })

  it('an Arabic-authored bio is not translated back into Arabic, and IS translated into English', () => {
    const targets = translationTargetsForSource('ar')
    expect(targets).not.toContain('ar')
    expect(targets).toContain('en')
  })

  it('no module outside locales.ts hardcodes a locale list', () => {
    const files = [
      'src/i18n/routing.ts',
      'src/lib/translation.ts',
      'src/lib/messages-parity.ts',
      'src/content/perch-updates.ts',
    ]
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      // A literal list is two or more quoted locale codes inside brackets.
      expect(src).not.toMatch(/\[\s*['"](?:en|fr|vi|zh-Hans|ar)['"]\s*,/)
    }
  })
})
