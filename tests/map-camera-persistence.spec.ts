import { test, expect, type Page } from '@playwright/test'

// The map's zoom and position survive leaving and returning to /map.

const HOUSE = {
  qr_code_id: 'CAMR01',
  slug: 'camera-house',
  status: 'live',
  artist_name: 'Camera Artist',
  bio: 'bio',
  bio_source_locale: 'en',
  lat: 48.1535,
  lng: 11.5920,
  is_invited_artist: false,
  tags: [],
}

async function stubMapData(page: Page) {
  await page.route('**/rest/v1/houses**', (route) => route.fulfill({ json: [HOUSE] }))
  await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/house_translations**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (route) => route.fulfill({ json: [] }))
}

/** Same technique as tests/map-desktop-focus.spec.ts: hook the `window.L`
 * assignment before any page script runs so even the map's own
 * constructor-time setView is caught, capturing the live instance on
 * window.__leafletMap. addInitScript persists across navigations within the
 * same page, so it stays active after the reload this spec does. */
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
          return original.apply(this, args)
        }
      },
    })
  })
}

async function getCamera(page: Page): Promise<{ lat: number; lng: number; zoom: number }> {
  return page.evaluate(() => {
    const map = (window as unknown as {
      __leafletMap: { getCenter: () => { lat: number; lng: number }; getZoom: () => number }
    }).__leafletMap
    const c = map.getCenter()
    return { lat: c.lat, lng: c.lng, zoom: map.getZoom() }
  })
}

test.describe('sticky map camera', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('changing zoom and position survives a reload of /map', async ({ page }) => {
    await instrumentLeaflet(page)
    await stubMapData(page)
    await page.goto('/map')

    const zoomIn = page.locator('.leaflet-control-zoom-in')
    await expect(zoomIn).toBeVisible({ timeout: 20000 })

    const before = await getCamera(page)

    // Change both zoom (real user control) and position (programmatic pan -
    // dragging via Playwright mouse events is flaky on this map; panBy fires
    // the same moveend the persister listens for).
    await zoomIn.click()
    await page.waitForTimeout(400) // leaflet zoom animation
    await page.evaluate(() => {
      const map = (window as unknown as { __leafletMap: { panBy: (o: [number, number]) => void } }).__leafletMap
      map.panBy([250, 150])
    })
    await page.waitForTimeout(400) // leaflet pan animation + moveend

    const changed = await getCamera(page)
    expect(changed.zoom).toBe(before.zoom + 1)
    expect(changed.lat).not.toBeCloseTo(before.lat, 5)

    const savedRaw = await page.evaluate(() => sessionStorage.getItem('perch.mapCamera'))
    expect(savedRaw).not.toBeNull()
    const saved = JSON.parse(savedRaw!)
    expect(saved.zoom).toBe(changed.zoom)

    // Reload: a fresh Map component mount, seeding its initial centre/zoom
    // from storage rather than the trail default.
    await page.reload()
    await expect(zoomIn).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(300)

    const restored = await getCamera(page)
    expect(restored.zoom).toBe(changed.zoom)
    expect(Math.abs(restored.lat - changed.lat)).toBeLessThan(0.001)
    expect(Math.abs(restored.lng - changed.lng)).toBeLessThan(0.001)
  })

  test('the profile mini-map ignores a persisted /map camera - stays at its fixed centre/zoom', async ({ page }) => {
    await instrumentLeaflet(page)
    await stubMapData(page)
    await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: [] }))
    await page.route('**/rest/v1/slug_history**', (route) => route.fulfill({ json: [] }))
    await page.goto('/map')

    const zoomIn = page.locator('.leaflet-control-zoom-in')
    await expect(zoomIn).toBeVisible({ timeout: 20000 })
    await zoomIn.click()
    await page.waitForTimeout(400) // leaflet ignores a second click mid-animation
    await zoomIn.click()
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      const map = (window as unknown as { __leafletMap: { panBy: (o: [number, number]) => void } }).__leafletMap
      map.panBy([300, 300])
    })
    await page.waitForTimeout(400)

    const camera = await page.evaluate(() => sessionStorage.getItem('perch.mapCamera'))
    expect(camera).not.toBeNull() // sanity: something non-default really is stored
    expect(JSON.parse(camera!).zoom).not.toBe(17)

    await page.goto('/v/camera-house')
    await page.waitForSelector('.leaflet-container', { timeout: 20000 })
    await page.waitForTimeout(300)

    const miniMapZoom = await getCamera(page)
    expect(miniMapZoom.zoom).toBe(17) // the profile mini-map's fixed zoom, per src/components/Map.tsx singleHouse path
    expect(Math.abs(miniMapZoom.lat - HOUSE.lat)).toBeLessThan(0.0005)
    expect(Math.abs(miniMapZoom.lng - HOUSE.lng)).toBeLessThan(0.0005)
  })
})
