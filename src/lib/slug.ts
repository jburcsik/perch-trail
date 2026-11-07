// URL-safe slug generation. Slugs become public URLs (/v/<slug>), so they
// must be lowercase, dash-separated, ASCII-only: no spaces (%20), punctuation,
// or characters that break or inject into a URL. Used everywhere a slug is saved.

// Routes that must never be shadowed by a profile slug.
const RESERVED = new Set([
  'admin', 'api', 'v', 'h', 'map', 'events', 'volunteer', 'get-involved',
  'request', 'recover', 'faq', 'privacy', 'terms', 'creator', 'preview', 'support', '_next',
])

/**
 * Normalise arbitrary input into a URL-safe slug, or null if nothing usable
 * remains (caller falls back to the qr_code_id). Strips accents, lowercases,
 * collapses any run of non-alphanumerics into a single dash, trims dashes,
 * caps length, and rejects reserved route names.
 */
export function slugify(input: string | null | undefined): string | null {
  if (!input) return null
  const s = String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // any non-alphanumeric run to a single dash
    .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
    .slice(0, 60)
    .replace(/-+$/g, '') // re-trim in case the slice cut mid-dash
  if (!s || RESERVED.has(s)) return null
  return s
}

/** Escape PostgREST ILIKE wildcards in user input so they match literally. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}
