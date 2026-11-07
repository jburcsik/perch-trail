import { test, expect, type Page } from '@playwright/test'
import { MAP_ZOOM } from '../src/config/site'

// Max zoom is 20. The map opens at MAP_ZOOM, so exactly (20 - MAP_ZOOM)
// zoom-in clicks reach the ceiling and disable the control.

async function stubMapData(page: Page) {
  await page.route('**/rest/v1/houses**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/house_translations**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (route) => route.fulfill({ json: [] }))
}

test('public map zoom-in disables once the 20 cap is reached', async ({ page }) => {
  await stubMapData(page)
  await page.goto('/map')
  const zoomIn = page.locator('.leaflet-control-zoom-in')
  await expect(zoomIn).toBeVisible({ timeout: 20000 })

  for (let i = 0; i < 20 - MAP_ZOOM; i++) {
    await zoomIn.click()
    await page.waitForTimeout(400) // leaflet zoom animation
  }
  await expect(zoomIn).toHaveClass(/leaflet-disabled/)
})
