import { test, expect, type Page } from '@playwright/test'

// The prev / back-to-map / next row sits above the LOCATION mini-map.

const HOUSE = {
  qr_code_id: 'NAVAB1',
  slug: 'nav-above-house',
  status: 'live',
  artist_name: 'Nav Artist',
  artist_bio: null,
  bio: null,
  bio_source_locale: 'en',
  artist_bio_source_locale: 'en',
  lat: 48.1535,
  lng: 11.5920,
  is_invited_artist: false,
  tags: [],
}

async function stubProfileData(page: Page) {
  await page.route('**/rest/v1/houses**', (route) => route.fulfill({ json: [HOUSE] }))
  await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/house_translations**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/slug_history**', (route) => route.fulfill({ json: [] }))
}

test('the back-to-map nav row precedes the LOCATION map in DOM order, and the map still renders', async ({ page }) => {
  await stubProfileData(page)
  await page.goto('/v/nav-above-house')

  await expect(page.getByRole('link', { name: /back to the map/i })).toBeVisible({ timeout: 20000 })
  await page.waitForSelector('.leaflet-container', { timeout: 20000 })

  const navPrecedesMap = await page.evaluate(() => {
    const nav = Array.from(document.querySelectorAll('a')).find(a => a.textContent?.includes('Back to the map'))
    const map = document.querySelector('.leaflet-container')
    if (!nav || !map) return null
    return !!(nav.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING)
  })

  expect(navPrecedesMap).toBe(true)
})
