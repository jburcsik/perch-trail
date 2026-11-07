// Every remote (Supabase) photo is routed through Next's image optimizer at the
// width its surface displays, never served at full resolution.

/** Serving ladder: the only widths any surface may request. Each is a member of
 * Next's default imageSizes/deviceSizes set (see the guard test in images.test.ts);
 * a width outside that set silently disables optimization. */
export const IMG_MARKER = 96
export const IMG_THUMB = 128
export const IMG_CARD = 384
export const IMG_HERO = 828
export const IMG_LIGHTBOX = 1200

/** The one quality value requested. Must be in next.config.ts `images.qualities`;
 * image-quality-linkage.test.ts checks the two agree. */
export const HOUSE_IMAGE_QUALITY = 75

/**
 * Build a Next image-optimizer URL for a remote photo at the given width.
 * Relative app assets and falsy input pass through unchanged. The overloads
 * let a non-nullable src narrow to a non-nullable result.
 */
export function houseImage(src: string, width: number): string
export function houseImage(src: string | null, width: number): string | null
export function houseImage(src: string | undefined, width: number): string | undefined
export function houseImage(src: string | null | undefined, width: number): string | null | undefined
export function houseImage(src: string | null | undefined, width: number): string | null | undefined {
  if (!src) return src
  if (!/^https?:\/\//.test(src)) return src
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${HOUSE_IMAGE_QUALITY}`
}

/** Lightbox slides from photo rows: full size at IMG_LIGHTBOX, thumbnail at IMG_THUMB. */
export function lightboxSlides(
  images: readonly { image_url: string }[]
): { src: string; thumbnail: string }[] {
  return images.map((img) => ({
    src: houseImage(img.image_url, IMG_LIGHTBOX),
    thumbnail: houseImage(img.image_url, IMG_THUMB),
  }))
}
