import { test, expect, type Page } from '@playwright/test'

// The back-to-map link carries no arrow glyph in the string (it would point
// the wrong way in RTL). The prev/next controls show the house emoji without
// it becoming part of the accessible name.

const HOUSES = [
  {
    qr_code_id: 'CPYA01',
    slug: 'copy-house-a',
    status: 'live',
    artist_name: 'A Artist',
    artist_bio: null,
    bio: null,
    bio_source_locale: 'en',
    artist_bio_source_locale: 'en',
    lat: 48.1535,
    lng: 11.5920,
    is_invited_artist: false,
    tags: [],
  },
  {
    qr_code_id: 'CPYB02',
    slug: 'copy-house-b',
    status: 'live',
    artist_name: 'B Artist',
    artist_bio: null,
    bio: null,
    bio_source_locale: 'en',
    artist_bio_source_locale: 'en',
    lat: 48.1536,
    lng: 11.5921,
    is_invited_artist: false,
    tags: [],
  },
  {
    qr_code_id: 'CPYC03',
    slug: 'copy-house-c',
    status: 'live',
    artist_name: 'C Artist',
    artist_bio: null,
    bio: null,
    bio_source_locale: 'en',
    artist_bio_source_locale: 'en',
    lat: 48.1537,
    lng: 11.5922,
    is_invited_artist: false,
    tags: [],
  },
]

async function stubProfileData(page: Page) {
  // The page makes TWO different queries against 'houses': the plain
  // allHouses list (for prev/next) and a slug=eq.<x> exact match resolved
  // with .maybeSingle(). Returning all 3 rows for both breaks maybeSingle
  // (more than one row means "multiple rows returned", a false 404), so filter by the
  // request URL like PostgREST would.
  await page.route('**/rest/v1/houses**', (route) => {
    const url = new URL(route.request().url())
    const slugFilter = url.searchParams.get('slug') // e.g. "eq.copy-house-b"
    if (slugFilter?.startsWith('eq.')) {
      const wanted = slugFilter.slice(3)
      return route.fulfill({ json: HOUSES.filter(h => h.slug === wanted) })
    }
    return route.fulfill({ json: HOUSES })
  })
  await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/house_translations**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/slug_history**', (route) => route.fulfill({ json: [] }))
}

test.describe('profile nav copy', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('back link has no arrow glyph; prev/next show the house emoji without changing the accessible name', async ({ page }) => {
    await stubProfileData(page)
    // The middle house: both prev and next are real links, not the
    // disabled opacity-20 placeholder.
    await page.goto('/v/copy-house-b')

    const backLink = page.getByRole('link', { name: /back to the map/i })
    await expect(backLink).toBeVisible({ timeout: 20000 })
    const backText = await backLink.textContent()
    expect(backText).not.toContain('<-')
    expect(backText).not.toContain('->')

    const prevLink = page.getByRole('link', { name: 'Previous birdhouse' })
    const nextLink = page.getByRole('link', { name: 'Next birdhouse' })
    await expect(prevLink).toBeVisible()
    await expect(nextLink).toBeVisible()
    await expect(prevLink).toContainText('\uD83C\uDFE0')
    await expect(nextLink).toContainText('\uD83C\uDFE0')

    // The emoji is decorative: the aria-label, not the inner text, is still the
    // accessible name.
    await expect(prevLink).toHaveAccessibleName('Previous birdhouse')
    await expect(nextLink).toHaveAccessibleName('Next birdhouse')

    // Nothing wraps or clips at 390px: both pills stay single-line height and
    // inside the viewport.
    const prevBox = await prevLink.boundingBox()
    const nextBox = await nextLink.boundingBox()
    expect(prevBox).not.toBeNull()
    expect(nextBox).not.toBeNull()
    expect(prevBox!.height).toBeLessThan(56)
    expect(nextBox!.height).toBeLessThan(56)
    expect(prevBox!.x).toBeGreaterThanOrEqual(0)
    expect(nextBox!.x + nextBox!.width).toBeLessThanOrEqual(390)
  })
})
