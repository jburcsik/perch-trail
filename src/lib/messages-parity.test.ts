/**
 * @jest-environment node
 *
 * Locale parity: every target locale must define exactly the keys in en.json.
 */
import {
  checkAllLocales,
  hasBlockingIssues,
  validateShapes,
  TARGET_LOCALES,
} from '@/lib/messages-parity'

describe('i18n locale parity', () => {
  const reports = checkAllLocales()

  it('covers every target locale', () => {
    expect(reports.map((r) => r.locale).sort()).toEqual([...TARGET_LOCALES].sort())
  })

  for (const locale of TARGET_LOCALES) {
    describe(locale, () => {
      const r = reports.find((x) => x.locale === locale)!

      it('has no missing keys (would render a raw key path)', () => {
        expect(r.missing).toEqual([])
      })

      it('has no extra keys not present in en.json', () => {
        expect(r.extra).toEqual([])
      })

      it('has no empty-string leaves', () => {
        expect(r.emptyLeaves).toEqual([])
      })
    })
  }

  it('reports no blocking issues across all locales', () => {
    expect(hasBlockingIssues(reports)).toBe(false)
  })

  it('every message file is a tree of non-empty string leaves', () => {
    expect(validateShapes()).toEqual([])
  })
})
