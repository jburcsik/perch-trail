import { nextDotNumber, nextDotLabel, isValidLatLng, labelFromPattern, nextPatternNumber, photoMarkerHtml, PHOTO_MARKER_SIZE } from './markers'
import { houseImage, IMG_MARKER } from './images'

describe('nextDotNumber', () => {
  it('starts at 1 with no dots', () => {
    expect(nextDotNumber([])).toBe(1)
  })

  it('increments past the highest existing Dot number', () => {
    expect(nextDotNumber(['Dot 001', 'Dot 041', 'Dot 007'])).toBe(42)
  })

  it('ignores renamed dots and non-matching labels', () => {
    expect(nextDotNumber(['blue birdhouse on the maple tree', 'Dot 003'])).toBe(4)
    expect(nextDotNumber(['Dot 3b', 'dot 5', 'Dotty 9'])).toBe(1)
  })

  it('never reuses a number after removal-style gaps', () => {
    // 002 was renamed/removed; max still wins, no gap-filling.
    expect(nextDotNumber(['Dot 001', 'Dot 003'])).toBe(4)
  })

  it('tolerates surrounding whitespace and unpadded numbers', () => {
    expect(nextDotNumber(['  Dot 12  '])).toBe(13)
  })
})

describe('nextDotLabel', () => {
  it('zero-pads to three digits', () => {
    expect(nextDotLabel([])).toBe('Dot 001')
    expect(nextDotLabel(['Dot 041'])).toBe('Dot 042')
  })

  it('keeps counting past 999 without truncating', () => {
    expect(nextDotLabel(['Dot 999'])).toBe('Dot 1000')
  })
})

describe('labelFromPattern / nextPatternNumber', () => {
  it('numbers a fresh pattern from 001', () => {
    expect(labelFromPattern('Orchard Row E {n}', [])).toBe('Orchard Row E 001')
  })

  it('continues past the highest label matching the pattern only', () => {
    const labels = ['Orchard Row E 007', 'Orchard Row W 020', 'Dot 099']
    expect(labelFromPattern('Orchard Row E {n}', labels)).toBe('Orchard Row E 008')
  })

  it('appends {n} when the pattern has none', () => {
    expect(labelFromPattern("The maple tree", ["The maple tree 002"])).toBe("The maple tree 003")
  })

  it('escapes regex specials in the pattern', () => {
    expect(labelFromPattern('Dot (east) {n}', ['Dot (east) 004'])).toBe('Dot (east) 005')
  })

  it('supports text after the number', () => {
    expect(labelFromPattern('Dot {n} east', ['Dot 002 east', 'Dot 010 west'])).toBe('Dot 003 east')
  })

  it('defaults to the classic Dot pattern equivalently', () => {
    expect(labelFromPattern('Dot {n}', ['Dot 041'])).toBe('Dot 042')
    expect(nextPatternNumber('Dot {n}', ['Dot 041'])).toBe(nextDotNumber(['Dot 041']))
  })
})

describe('photoMarkerHtml', () => {
  // Same fixture URL used in src/lib/images.test.ts, for consistency.
  const SUPABASE_URL = 'https://example.supabase.co/storage/v1/object/public/house-images/ABC123/1690000000000-photo.jpg'

  it('routes the image through the Next optimizer, not the original', () => {
    const html = photoMarkerHtml(SUPABASE_URL, false)
    expect(html).toContain('/_next/image')
  })

  it('requests the marker width (96px)', () => {
    const html = photoMarkerHtml(SUPABASE_URL, false)
    expect(html).toContain(`w=${IMG_MARKER}`)
  })

  it('never leaks the bare Supabase URL un-encoded', () => {
    // encodeURIComponent turns the URL's slashes into %2F, so this substring
    // only survives if the original URL leaked through unoptimized.
    const html = photoMarkerHtml(SUPABASE_URL, false)
    expect(html).not.toContain('example.supabase.co/storage')
  })

  it('still escapes the optimizer URL for safe HTML embedding', () => {
    const html = photoMarkerHtml(SUPABASE_URL, false)
    const expectedSrc = (houseImage(SUPABASE_URL, IMG_MARKER) as string).replace(/&/g, '&amp;')
    expect(html).toContain(`src="${expectedSrc}"`)
  })

  it("sizes the marker div to PHOTO_MARKER_SIZE, kept in sync with Map.tsx's iconSize", () => {
    const html = photoMarkerHtml(SUPABASE_URL, false)
    expect(html).toContain(`width:${PHOTO_MARKER_SIZE}px;height:${PHOTO_MARKER_SIZE}px`)
  })
})

describe('isValidLatLng', () => {
  it('accepts an ordinary city coordinate', () => {
    expect(isValidLatLng(40.7812, -73.9665)).toBe(true)
  })

  it('rejects NaN, infinities, and out-of-range values', () => {
    expect(isValidLatLng(NaN, 0)).toBe(false)
    expect(isValidLatLng(0, Infinity)).toBe(false)
    expect(isValidLatLng(91, 0)).toBe(false)
    expect(isValidLatLng(0, -181)).toBe(false)
  })
})
