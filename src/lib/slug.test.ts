/**
 * @jest-environment node
 */
import { slugify, escapeLike } from './slug'

describe('slugify', () => {
  it('turns spaces into single dashes, lowercased (no %20 in URLs)', () => {
    expect(slugify('Maple Hollow Reclaimed Big Bird House')).toBe('maple-hollow-reclaimed-big-bird-house')
  })

  it('strips URL-unsafe punctuation', () => {
    expect(slugify('kiln lane what dis edit?')).toBe('kiln-lane-what-dis-edit')
    expect(slugify('a/b\\c?d#e')).toBe('a-b-c-d-e')
  })

  it('collapses runs and trims dashes', () => {
    expect(slugify('  --Hello   World!!--  ')).toBe('hello-world')
  })

  it('strips accents', () => {
    expect(slugify('Caf\u00e9 Ni\u00e7oise')).toBe('cafe-nicoise')
  })

  it('returns null for empty / unusable input', () => {
    expect(slugify('')).toBeNull()
    expect(slugify(null)).toBeNull()
    expect(slugify('!!!')).toBeNull()
  })

  it('rejects reserved route names', () => {
    expect(slugify('admin')).toBeNull()
    expect(slugify('API')).toBeNull()
  })

  it('caps length', () => {
    expect(slugify('x'.repeat(200))!.length).toBeLessThanOrEqual(60)
  })
})

describe('escapeLike', () => {
  it('escapes ILIKE wildcards so they match literally', () => {
    expect(escapeLike('100%_off')).toBe('100\\%\\_off')
    expect(escapeLike('a\\b')).toBe('a\\\\b')
  })
})
