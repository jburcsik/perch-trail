import { test, expect, type Page } from '@playwright/test'

// On desktop a pin click centres the map on the house and scrolls the
// matching gallery card to the top of the right panel, marking it selected
// without reordering the list. The recentre keeps the zoom level and fires
// again every time the same house is re-selected.

const HOUSES = [
  {
    qr_code_id: 'ALPHA1',
    slug: 'alpha-house',
    status: 'live',
    artist_name: 'Alpha Artist',
    bio: 'Alpha bio',
    bio_source_locale: 'en',
    lat: 48.1535,
    lng: 11.5920,
    is_invited_artist: false,
    tags: [],
  },
  {
    qr_code_id: 'BETA02',
    slug: 'beta-house',
    status: 'live',
    artist_name: 'Beta Artist',
    bio: 'Beta bio',
    bio_source_locale: 'en',
    lat: 48.1544,
    lng: 11.5930,
    is_invited_artist: false,
    tags: [],
  },
]

const IMAGES = HOUSES.map(h => ({
  qr_code_id: h.qr_code_id,
  image_url: `https://example.supabase.co/storage/v1/object/public/house-images/${h.qr_code_id}.jpg`,
  display_order: 1,
}))

async function stubMapData(page: Page) {
  await page.route('**/rest/v1/houses**', (route) => route.fulfill({ json: HOUSES }))
  await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: IMAGES }))
  await page.route('**/rest/v1/house_translations**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (route) => route.fulfill({ json: [] }))
}

/**
 * Hooks the `window.L` assignment itself (via addInitScript, active before
 * any page script runs) so the very first `L.Map.prototype.setView` call -
 * Leaflet's own constructor-time call - is already patched. Captures the
 * live map instance on `window.__leafletMap` for direct getZoom()/getCenter()
 * reads, and counts calls on `window.__setViewCalls`. A post-hoc patch (after
 * waiting for a marker to be visible) is too late: the constructor's setView
 * has usually already fired by then.
 */
async function instrumentLeaflet(page: Page) {
  await page.addInitScript(() => {
    let realL: unknown
    Object.defineProperty(window, 'L', {
      configurable: true,
      get() {
        return realL
      },
      set(value: { Map: { prototype: { setView: (...a: unknown[]) => unknown } } }) {
        realL = value
        const original = value.Map.prototype.setView
        value.Map.prototype.setView = function (this: unknown, ...args: unknown[]) {
          ;(window as unknown as { __leafletMap: unknown }).__leafletMap = this
          const w = window as unknown as { __setViewCalls: number }
          w.__setViewCalls = (w.__setViewCalls ?? 0) + 1
          return original.apply(this, args)
        }
      },
    })
  })
}

async function getZoom(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __leafletMap: { getZoom: () => number } }).__leafletMap.getZoom())
}

async function getCenter(page: Page): Promise<{ lat: number; lng: number }> {
  return page.evaluate(() =>
    (window as unknown as { __leafletMap: { getCenter: () => { lat: number; lng: number } } }).__leafletMap.getCenter()
  )
}

test.describe('desktop pin-focus flow', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('clicking a pin selects & scrolls the matching card, never renders the sheet, keeps list order, does NOT change zoom', async ({ page }) => {
    await instrumentLeaflet(page)
    await stubMapData(page)
    await page.goto('/map')

    const markers = page.locator('.leaflet-marker-pane .leaflet-marker-icon.leaflet-interactive')
    await expect(markers).toHaveCount(2, { timeout: 20000 })

    const cards = page.getByTestId('gallery-card')
    await expect(cards).toHaveCount(2)
    const firstCardNameBefore = await cards.first().locator('p').first().textContent()

    const zoomBefore = await getZoom(page)

    // Click the second marker (Beta), which is not already at the top of the
    // panel. Settle first so the click lands after the initial layout.
    await markers.nth(1).waitFor({ state: 'visible' })
    await page.waitForTimeout(300)
    await markers.nth(1).click()

    // No sheet anywhere in the DOM on desktop.
    await expect(page.getByTestId('house-sheet')).toHaveCount(0)

    const selectedCard = page.locator('[data-testid="gallery-card"][data-selected="true"]')
    await expect(selectedCard).toHaveCount(1, { timeout: 10000 })
    await expect(selectedCard).toContainText('Beta House')

    // recentring must not touch the zoom level at all.
    await page.waitForTimeout(500) // leaflet pan animation
    const zoomAfter = await getZoom(page)
    expect(zoomAfter).toBe(zoomBefore)

    // Card scrolled clear of the sticky header (not tucked under it).
    const headerBottom = await page.getByTestId('gallery-panel-header').evaluate(el => el.getBoundingClientRect().bottom)
    const cardTop = await selectedCard.evaluate(el => el.getBoundingClientRect().top)
    expect(cardTop).toBeGreaterThanOrEqual(headerBottom - 1) // allow 1px rounding

    // List order unchanged.
    const firstCardNameAfter = await cards.first().locator('p').first().textContent()
    expect(firstCardNameAfter).toBe(firstCardNameBefore)
  })

  test('re-clicking the same house after panning away recentres it and re-scrolls its card', async ({ page }) => {
    await instrumentLeaflet(page)
    await stubMapData(page)
    await page.goto('/map')

    const markers = page.locator('.leaflet-marker-pane .leaflet-marker-icon.leaflet-interactive')
    await expect(markers).toHaveCount(2, { timeout: 20000 })
    await markers.first().waitFor({ state: 'visible' })
    await page.waitForTimeout(300)

    // Select Beta (marker 1), not the first card: the first card is already
    // at scroll position 0, so scrolling it into focus proves nothing.
    await markers.nth(1).click()
    const selectedCard = page.locator('[data-testid="gallery-card"][data-selected="true"]')
    await expect(selectedCard).toHaveCount(1, { timeout: 10000 })
    await expect(selectedCard).toContainText('Beta House')
    await page.waitForTimeout(500)

    // Pan the map away (simulating the user dragging elsewhere) and scroll
    // the panel back to the top; Beta is no longer the first card there, so
    // this genuinely moves its card out of the clear-of-header position.
    // Both must be reversed by re-clicking Beta's marker again.
    await page.evaluate(() => {
      const map = (window as unknown as { __leafletMap: { panBy: (offset: [number, number]) => void } }).__leafletMap
      map.panBy([400, 300])
    })
    await page.getByTestId('gallery-panel').evaluate(el => { el.scrollTop = 0 })
    await page.waitForTimeout(300)

    const centerAfterPan = await getCenter(page)
    // Sanity: the pan actually moved the map away from Beta.
    expect(Math.abs(centerAfterPan.lat - HOUSES[1].lat)).toBeGreaterThan(0.0005)

    // Re-click the SAME marker (Beta).
    await markers.nth(1).click()
    await page.waitForTimeout(500)

    const centerAfterReclick = await getCenter(page)
    expect(Math.abs(centerAfterReclick.lat - HOUSES[1].lat)).toBeLessThan(0.0005)
    expect(Math.abs(centerAfterReclick.lng - HOUSES[1].lng)).toBeLessThan(0.0005)

    // Card re-scrolled into focus (clear of the sticky header again). Poll
    // rather than a single fixed-delay read: the smooth scrollIntoView
    // animation can still be a few px short of settled at 500ms under load.
    const headerBottom = await page.getByTestId('gallery-panel-header').evaluate(el => el.getBoundingClientRect().bottom)
    await expect
      .poll(async () => selectedCard.evaluate(el => el.getBoundingClientRect().top), { timeout: 5000 })
      .toBeGreaterThanOrEqual(headerBottom - 1)
  })
})
