/**
 * @jest-environment node
 */
import { parseQrCodeId } from './profile-url'

describe('parseQrCodeId', () => {
  it('extracts the 5-char code from a valid profile URL', () => {
    expect(parseQrCodeId('https://perchtrail.example/h/ABC12')).toBe('ABC12')
  })

  it('uppercases lowercase codes', () => {
    expect(parseQrCodeId('https://perchtrail.example/h/abc12')).toBe('ABC12')
  })

  it('accepts a shorter valid code', () => {
    expect(parseQrCodeId('https://perchtrail.example/h/XY9')).toBe('XY9')
  })

  it('works with a URL that has a query string', () => {
    expect(parseQrCodeId('https://perchtrail.example/h/ABC12?edit=ZZZZ')).toBe('ABC12')
  })

  it('works with localhost', () => {
    expect(parseQrCodeId('http://localhost:3000/h/ABC12')).toBe('ABC12')
  })

  it('works with a locale prefix', () => {
    expect(parseQrCodeId('https://perchtrail.example/fr/h/ABC12')).toBe('ABC12')
  })

  it('returns null for URLs that do not contain /h/:code', () => {
    expect(parseQrCodeId('https://perchtrail.example/map')).toBeNull()
    expect(parseQrCodeId('https://perchtrail.example/')).toBeNull()
  })

  it('returns null for invalid URLs', () => {
    expect(parseQrCodeId('not a url')).toBeNull()
    expect(parseQrCodeId('')).toBeNull()
  })
})
