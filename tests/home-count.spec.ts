import { test, expect, type Page } from '@playwright/test'

// The homepage badge matches the admin "Live Houses" count (profiled houses
// only), not the combined houses plus street-dots total that /map shows
// (see tests/street-dots-map.spec.ts).

const HOUSES = Array.from({ length: 3 }, (_, i) => ({
  qr_code_id: `TEST${i}`,
  slug: `stub-house-${i}`,
  status: 'live',
  artist_name: 'Stub Artist',
  bio: 'A stubbed birdhouse.',
  lat: 48.1535 + i * 0.0002,
  lng: 11.5920 + i * 0.0003,
  is_invited_artist: false,
  tags: [],
}))

// Street dots must not be added into the homepage's headline number.
const MARKERS = Array.from({ length: 5 }, (_, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  lat: 48.15 + i * 0.0002,
  lng: 11.60 + i * 0.0003,
}))

async function stubHomeData(page: Page) {
  await page.route('**/rest/v1/houses**', (route) =>
    route.fulfill({
      json: HOUSES,
      headers: {
        'content-range': `0-${HOUSES.length - 1}/${HOUSES.length}`,
        // fetchLiveCount() uses count:'exact',head:true - the browser only
        // exposes content-range to JS cross-origin if the response says so.
        'access-control-expose-headers': 'content-range',
      },
    })
  )
  await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/house_translations**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (route) =>
    route.fulfill({ json: MARKERS, headers: { 'content-range': `0-${MARKERS.length - 1}/${MARKERS.length}` } })
  )
}

test.describe('homepage live-birdhouse count', () => {
  test('shows the profiled live-house count only, not houses + street dots', async ({ page }) => {
    await stubHomeData(page)
    await page.goto('/en')
    // liveCount and mapMarkers resolve from two separate fetch chains of
    // different lengths - wait for both to settle before reading the badge,
    // or an assertion can catch it mid-transition (e.g. matching liveCount
    // alone before mapMarkers has arrived) and report a false pass.
    await page.waitForLoadState('networkidle')

    // 3 profiled houses, 5 street dots - badge must read 3, not 8, and must
    // stay 3 (not flip once the slower fetch resolves).
    const badge = page.getByTestId('home-count')
    await expect(badge).toContainText('3', { timeout: 20000 })
    await page.waitForTimeout(1000)
    await expect(badge).toContainText('3')
    await expect(badge).not.toContainText('8')
  })
})
