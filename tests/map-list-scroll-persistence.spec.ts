import { test, expect, type Page } from '@playwright/test'

// Returning to list view after a profile visit restores the scroll offset.

const HOUSES = Array.from({ length: 8 }, (_, i) => ({
  qr_code_id: `SCRL${i}X`,
  slug: `scroll-house-${i}`,
  status: 'live',
  artist_name: `Scroll Artist ${i}`,
  bio: 'bio',
  bio_source_locale: 'en',
  lat: 48.1535 + i * 0.0004,
  lng: 11.5920 + i * 0.0004,
  is_invited_artist: false,
  tags: [],
}))

const IMAGES = HOUSES.map(h => ({
  qr_code_id: h.qr_code_id,
  image_url: `https://example.supabase.co/storage/v1/object/public/house-images/${h.qr_code_id}.jpg`,
  display_order: 1,
}))

async function stubMapData(page: Page) {
  // The profile page this test navigates to resolves its house with
  // .maybeSingle() on a slug=eq.<x> filter; returning all 8 rows for that
  // query (as for the /map page's plain list query) makes it see "multiple
  // rows returned" and 404. Filter by the request URL like PostgREST would.
  await page.route('**/rest/v1/houses**', (route) => {
    const url = new URL(route.request().url())
    const slugFilter = url.searchParams.get('slug') // e.g. "eq.scroll-house-0"
    if (slugFilter?.startsWith('eq.')) {
      const wanted = slugFilter.slice(3)
      return route.fulfill({ json: HOUSES.filter(h => h.slug === wanted) })
    }
    return route.fulfill({ json: HOUSES })
  })
  await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: IMAGES }))
  await page.route('**/rest/v1/house_translations**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/slug_history**', (route) => route.fulfill({ json: [] }))
}

test.describe('sticky list scroll', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('scrolling the list, visiting a profile, and returning restores the scroll offset', async ({ page }) => {
    await stubMapData(page)
    await page.goto('/map')

    await page.getByTestId('map-list-toggle').getByRole('button', { name: 'List' }).click()
    const panel = page.getByTestId('gallery-panel')
    await expect(page.getByTestId('gallery-card')).toHaveCount(8)

    // Scroll deep enough that the restore is unmistakable if it fails (would
    // read back near 0).
    await panel.evaluate(el => { el.scrollTop = 500 })
    // Programmatic scrollTop fires the native 'scroll' event asynchronously,
    // and the page's own handler further coalesces the write via
    // requestAnimationFrame, so give both a moment to land.
    await page.waitForTimeout(400)

    const scrollTopBeforeLeaving = await panel.evaluate(el => el.scrollTop)
    expect(scrollTopBeforeLeaving).toBeGreaterThan(400) // sanity: it actually scrolled

    const savedRaw = await page.evaluate(() => sessionStorage.getItem('perch.mapListScrollTop'))
    expect(Number(savedRaw)).toBeGreaterThan(400)

    // Navigate to a profile WITHOUT Playwright's click auto-scrolling the
    // panel back toward the target first (that would overwrite our saved
    // offset with wherever the auto-scroll landed, before we even leave).
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="card-learn-more"]') as HTMLElement | null
      link?.click()
    })
    await expect(page).toHaveURL(/\/v\//)

    await page.getByRole('link', { name: /back to the map/i }).click()
    await expect(page).toHaveURL(/\/map/)

    // List view restored and the scroll offset restored with it.
    await expect(page.getByTestId('gallery-card')).toHaveCount(8)
    await expect
      .poll(async () => panel.evaluate(el => el.scrollTop), { timeout: 5000 })
      .toBeGreaterThan(400)
  })
})
