import { houseImage, lightboxSlides, IMG_MARKER, IMG_THUMB, IMG_CARD, IMG_HERO, IMG_LIGHTBOX } from './images'

const SUPABASE_URL = 'https://example.supabase.co/storage/v1/object/public/house-images/ABC123/1690000000000-photo.jpg'
const SUPABASE_URL_2 = 'https://example.supabase.co/storage/v1/object/public/house-images/XYZ789/1690000000001-second.jpg'

describe('houseImage', () => {
  it('returns the Next optimizer URL for a Supabase public URL, src percent-encoded', () => {
    expect(houseImage(SUPABASE_URL, IMG_MARKER)).toBe(
      `/_next/image?url=${encodeURIComponent(SUPABASE_URL)}&w=96&q=75`
    )
  })

  it('returns a local/relative path unchanged, not routed through the optimizer', () => {
    expect(houseImage('/default-birdhouse.svg', IMG_CARD)).toBe('/default-birdhouse.svg')
  })

  it('returns null unchanged', () => {
    expect(houseImage(null, IMG_MARKER)).toBeNull()
  })

  it('returns undefined unchanged', () => {
    expect(houseImage(undefined, IMG_MARKER)).toBeUndefined()
  })

  it('returns an empty string unchanged', () => {
    expect(houseImage('', IMG_MARKER)).toBe('')
  })

  it('emits the width verbatim, no clamping or rounding', () => {
    // 999 is not in Next's allowed imageSizes/deviceSizes set on purpose;
    // houseImage itself does no validation, that's the constants' job.
    expect(houseImage(SUPABASE_URL, 999)).toBe(
      `/_next/image?url=${encodeURIComponent(SUPABASE_URL)}&w=999&q=75`
    )
  })
})

describe('lightboxSlides', () => {
  it('returns an empty array for an empty input', () => {
    expect(lightboxSlides([])).toEqual([])
  })

  it('maps an image to a slide with src at IMG_LIGHTBOX and thumbnail at IMG_THUMB', () => {
    const [slide] = lightboxSlides([{ image_url: SUPABASE_URL }])
    expect(slide.src).toBe(houseImage(SUPABASE_URL, IMG_LIGHTBOX))
    expect(slide.thumbnail).toBe(houseImage(SUPABASE_URL, IMG_THUMB))
  })

  it('requests different widths for src and thumbnail, both routed through the optimizer', () => {
    const [slide] = lightboxSlides([{ image_url: SUPABASE_URL }])
    expect(slide.src).toContain('/_next/image')
    expect(slide.src).toContain(`w=${IMG_LIGHTBOX}`)
    expect(slide.thumbnail).toContain('/_next/image')
    expect(slide.thumbnail).toContain(`w=${IMG_THUMB}`)
  })

  it('maps multiple images independently, preserving order', () => {
    const slides = lightboxSlides([{ image_url: SUPABASE_URL }, { image_url: SUPABASE_URL_2 }])
    expect(slides).toHaveLength(2)
    expect(slides[0].src).toBe(houseImage(SUPABASE_URL, IMG_LIGHTBOX))
    expect(slides[1].src).toBe(houseImage(SUPABASE_URL_2, IMG_LIGHTBOX))
  })
})

describe('houseImage overload narrowing', () => {
  // Type-level contract: Jest does not type-check, so `tsc --noEmit` is what
  // fails if the overloads regress. Kept as runtime assertions as well.
  it('a non-nullable src produces a non-nullable, non-optional result (string in, string out)', () => {
    const definitelyString: string = SUPABASE_URL
    const result: string = houseImage(definitelyString, IMG_MARKER)
    expect(result).toBe(houseImage(SUPABASE_URL, IMG_MARKER))
  })

  it('a string | null src produces a string | null result (no undefined in the type)', () => {
    const maybeNull: string | null = null
    const result: string | null = houseImage(maybeNull, IMG_MARKER)
    expect(result).toBeNull()
  })
})

describe('width ladder constants', () => {
  // Next's default imageSizes concatenated with deviceSizes. A width outside
  // this set silently falls back to serving the original, unoptimized image.
  const ALLOWED_WIDTHS = new Set([32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840])

  it('every exported width constant is in the allowed Next image size set', () => {
    for (const width of [IMG_MARKER, IMG_THUMB, IMG_CARD, IMG_HERO, IMG_LIGHTBOX]) {
      expect(ALLOWED_WIDTHS.has(width)).toBe(true)
    }
  })
})
