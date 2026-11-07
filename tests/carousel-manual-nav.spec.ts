import { test, expect, type Page } from '@playwright/test'

// Featured Perches carousel: a real scroll region with prev/next buttons.
// Stubs enough houses to make the track wider than the viewport, following
// the pattern in tests/street-dots-map.spec.ts.

// The homepage also fetches `houses` for its mini-map preview (lat/lng
// required there, or Leaflet throws "Invalid LatLng object"), same table,
// same stubbed route, so the fixture needs to satisfy both consumers.
const HOUSES = Array.from({ length: 8 }, (_, i) => ({
  qr_code_id: `TEST${i}`,
  slug: `stub-house-${i}`,
  status: 'live',
  artist_name: `Stub Artist ${i}`,
  bio: null,
  lat: 48.1535 + i * 0.0002,
  lng: 11.5920 + i * 0.0003,
  is_invited_artist: false,
  tags: [],
}))

async function stubFeaturedHouses(page: Page) {
  await page.route('**/rest/v1/houses**', (route) =>
    route.fulfill({ json: HOUSES, headers: { 'content-range': `0-${HOUSES.length - 1}/${HOUSES.length}` } })
  )
  await page.route('**/rest/v1/house_images**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (route) => route.fulfill({ json: [] }))
}

test.describe('Featured Perches carousel manual navigation', () => {
  test('the track is a real scrollable region, not overflow:hidden', async ({ page }) => {
    await stubFeaturedHouses(page)
    await page.goto('/en')
    const track = page.locator('.carousel-mask')
    await expect(track).toBeVisible()
    const overflowX = await track.evaluate((el) => getComputedStyle(el).overflowX)
    expect(overflowX).toBe('auto')
  })

  test('clicking next moves the scroll position forward, clicking previous moves it back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await stubFeaturedHouses(page)
    await page.goto('/en')
    const track = page.locator('.carousel-mask')
    await expect(track).toBeVisible()

    const initialScroll = await track.evaluate((el) => el.scrollLeft)
    await page.getByRole('button', { name: 'Next perch' }).click()
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(initialScroll)

    const afterNext = await track.evaluate((el) => el.scrollLeft)
    await page.getByRole('button', { name: 'Previous perch' }).click()
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeLessThan(afterNext)
  })

  test('a native wheel scroll moves the track', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await stubFeaturedHouses(page)
    await page.goto('/en')
    const track = page.locator('.carousel-mask')
    await expect(track).toBeVisible()

    const box = await track.boundingBox()
    if (!box) throw new Error('carousel track has no bounding box')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(300, 0)

    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  })

  test('auto-advance stops for good after a manual click', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await stubFeaturedHouses(page)
    await page.goto('/en')
    const track = page.locator('.carousel-mask')
    await expect(track).toBeVisible()

    await page.getByRole('button', { name: 'Next perch' }).click()
    // Let the click's own smooth-scroll settle before taking the baseline -
    // otherwise we'd catch it mid-animation and mistake that for drift.
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    await page.waitForTimeout(500)
    const afterClick = await track.evaluate((el) => el.scrollLeft)

    // Move the mouse off the carousel so hover-pause isn't what's holding it still,
    // then wait past one auto-advance tick (4s); it should stay put either way.
    await page.mouse.move(10, 10)
    await page.waitForTimeout(4500)
    const afterWait = await track.evaluate((el) => el.scrollLeft)
    expect(afterWait).toBe(afterClick)
  })
})
