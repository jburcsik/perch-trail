import { getLocaleDirection } from './direction'

describe('getLocaleDirection', () => {
  it('returns ltr for en, fr, vi, zh-Hans', () => {
    expect(getLocaleDirection('en')).toBe('ltr')
    expect(getLocaleDirection('fr')).toBe('ltr')
    expect(getLocaleDirection('vi')).toBe('ltr')
    expect(getLocaleDirection('zh-Hans')).toBe('ltr')
  })

  it('returns rtl for ar', () => {
    expect(getLocaleDirection('ar')).toBe('rtl')
  })
})
