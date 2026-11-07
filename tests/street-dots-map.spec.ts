import { test, expect, type Page } from '@playwright/test'

// Street Dots on the public map. Stubs the Supabase REST responses so no
// fixtures (or even the map_markers table) are required: the page renders
// from the stubbed payloads.

const HOUSES = [
  {
    qr_code_id: 'TESTX',
    slug: 'stub-house',
    status: 'live',
    artist_name: 'Stub Artist',
    bio: 'A stubbed birdhouse.',
    bio_source_locale: 'en',
    lat: 48.1535,
    lng: 11.5920,
    is_invited_artist: false,
    tags: [],
  },
]

const MARKERS = Array.from({ length: 5 }, (_, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  lat: 48.1535 + i * 0.0002,
  lng: 11.5920 + i * 0.0003,
}))

async function stubMapData(page: Page) {
  await page.route('**/rest/v1/houses**', (route) =>
    route.fulfill({ json: HOUSES, headers: { 'content-range': '0-0/1' } })
  )
  await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/house_translations**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (route) =>
    route.fulfill({ json: MARKERS, headers: { 'content-range': `0-${MARKERS.length - 1}/${MARKERS.length}` } })
  )
}

test.describe('street dots on /map (stubbed data)', () => {
  test('headline shows ONE total (houses + dots) with the Featured header', async ({ page }) => {
    await stubMapData(page)
    await page.goto('/map')

    // 1 profiled house + 5 dots = 6, one number, no second count.
    await expect(page.getByTestId('birdhouse-count')).toContainText('(6)', { timeout: 20000 })
    await expect(page.getByTestId('featured-header')).toBeVisible()
    await expect(page.getByTestId('featured-header')).not.toContainText(/\d/)
  })

  test('dots render inert: no click target, beneath the pins', async ({ page }) => {
    await stubMapData(page)
    await page.goto('/map')
    await expect(page.getByTestId('birdhouse-count')).toContainText('(6)', { timeout: 20000 })

    // Leaflet gives interactive markers the 'leaflet-interactive' class and a
    // click cursor; inert dots must not have it. 1 interactive house marker,
    // 5 non-interactive dots.
    const map = page.locator('.leaflet-marker-pane')
    await expect(map.locator('.leaflet-marker-icon')).toHaveCount(6)
    await expect(map.locator('.leaflet-marker-icon.leaflet-interactive')).toHaveCount(1)

    // Clicking a dot must not open the bottom sheet.
    const dot = map.locator('.leaflet-marker-icon:not(.leaflet-interactive)').first()
    await dot.click({ force: true })
    await expect(page.getByTestId('sheet-bio')).toHaveCount(0)
  })

  test('empty markers table keeps the profiled-only count working', async ({ page }) => {
    await page.route('**/rest/v1/houses**', (route) => route.fulfill({ json: HOUSES }))
    await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: [] }))
    await page.route('**/rest/v1/house_translations**', (route) => route.fulfill({ json: [] }))
    await page.route('**/rest/v1/map_markers**', (route) => route.fulfill({ json: [] }))
    await page.goto('/map')

    await expect(page.getByTestId('birdhouse-count')).toContainText('(1)', { timeout: 20000 })
  })
})
