import { test, expect, type Page } from '@playwright/test'

// View mode persists in sessionStorage so the profile back-link and browser
// back restore the view the user left from.

const HOUSE = {
  qr_code_id: 'PERS01',
  slug: 'persist-house',
  status: 'live',
  artist_name: 'Persist Artist',
  bio: 'bio',
  bio_source_locale: 'en',
  lat: 48.1535,
  lng: 11.5920,
  is_invited_artist: false,
  tags: [],
}

const IMAGES = [
  {
    qr_code_id: HOUSE.qr_code_id,
    image_url: 'https://example.supabase.co/storage/v1/object/public/house-images/persist01.jpg',
    display_order: 1,
  },
]

async function stubMapData(page: Page) {
  await page.route('**/rest/v1/houses**', (route) => route.fulfill({ json: [HOUSE] }))
  await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: IMAGES }))
  await page.route('**/rest/v1/house_translations**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (route) => route.fulfill({ json: [] }))
}

test.describe('view-mode persistence', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('list -> profile -> back to map restores list view', async ({ page }) => {
    await stubMapData(page)
    await page.goto('/map')

    await page.getByTestId('map-list-toggle').getByRole('button', { name: 'List' }).click()
    await expect(page.getByTestId('gallery-card')).toBeVisible()

    await page.getByTestId('card-learn-more').first().click()
    await expect(page).toHaveURL(/\/v\//)

    await page.getByRole('link', { name: /back to the map/i }).click()
    await expect(page).toHaveURL(/\/map/)

    // List view restored: cards render (map view would hide them on mobile)
    // and the List pill button shows the active state.
    await expect(page.getByTestId('gallery-card')).toBeVisible()
    const listButton = page.getByTestId('map-list-toggle').getByRole('button', { name: 'List' })
    await expect(listButton).toHaveClass(/bg-amber-600/)
  })
})
