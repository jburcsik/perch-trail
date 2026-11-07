// Site-wide constants for the demo deployment. The names are fixtures; the map centre is a public park used for demo tiles.

/** Public name of the trail, shown in the nav, metadata and emails. */
export const SITE_NAME: string = 'Perch Trail'

/** One-line description for page metadata. */
export const SITE_DESCRIPTION: string = 'A street-art trail of hand-painted birdhouses, each with its own page and story.'

/** Fallback for SITE_URL when the env var is unset. */
export const SITE_URL_DEFAULT: string = 'https://perchtrail.example'

/** The invented district the fixture trail runs through. */
export const NEIGHBOURHOOD: string = 'Maple Hollow'

/** Map centre as [lat, lng]: NEXT_PUBLIC_MAP_CENTER="lat,lng" when set, else the fixture trail. */
export const MAP_CENTER: [number, number] = parseMapCenter(process.env.NEXT_PUBLIC_MAP_CENTER) ?? [48.1535, 11.592]

function parseMapCenter(value: string | undefined): [number, number] | null {
  const parts = (value ?? '').split(',').map((p) => Number(p.trim()))
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null
  const [lat, lng] = parts
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null
}

/** Default zoom for the trail map at MAP_CENTER. */
export const MAP_ZOOM: number = 16

/** Fallback for EMAIL_FROM when the env var is unset. */
export const EMAIL_FROM_DEFAULT: string = 'Perch Trail <hello@perchtrail.example>'
