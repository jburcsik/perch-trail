/**
 * Raster basemap tiles from Stadia Maps. NEXT_PUBLIC_STADIA_API_KEY is optional:
 * without it the URL is keyless, which works on localhost. The key is public by
 * nature (the browser fetches tiles); the control is the domain restriction set
 * on the key in the Stadia dashboard.
 */

/** Host every basemap tile is fetched from. */
export const BASEMAP_TILE_HOST = 'tiles.stadiamaps.com'

/** Stadia style id. Positron-derived light style, quiet under many markers. */
const BASEMAP_STYLE = 'alidade_smooth'

const BASEMAP_API_KEY = process.env.NEXT_PUBLIC_STADIA_API_KEY ?? ''

// Interpolated into one template literal; a string concatenation here is
// folded incorrectly by the production build. `{r}` resolves to @2x on HiDPI.
const BASEMAP_QUERY = BASEMAP_API_KEY ? `?api_key=${BASEMAP_API_KEY}` : ''

export const BASEMAP_TILE_URL = `https://${BASEMAP_TILE_HOST}/tiles/${BASEMAP_STYLE}/{z}/{x}/{y}{r}.png${BASEMAP_QUERY}`

/** Required attribution under ODbL and Stadia's terms. */
export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a> ' +
  '&copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'

/** Highest zoom Stadia serves for this style. */
export const BASEMAP_PROVIDER_MAX_ZOOM = 20
