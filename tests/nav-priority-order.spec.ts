import { test, expect } from '@playwright/test'

// Nav priority: "Get a Birdhouse" is a top-level link and "News" lives in
// the More menu.

test.describe('Nav priority order', () => {
  test('Get a Birdhouse is reachable from the top level, no dropdown needed', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav').first()
    const cta = nav.getByRole('link', { name: /get a birdhouse/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', /\/get-involved\?open=birdhouse$/)
  })

  test('clicking it lands on the birdhouse section', async ({ page }) => {
    await page.goto('/')
    await page.locator('nav').first().getByRole('link', { name: /get a birdhouse/i }).click()
    await expect(page).toHaveURL(/\/get-involved\?open=birdhouse$/)
  })

  test('News has moved into More, and is no longer top level', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav').first()
    // Not visible before opening the menu...
    await expect(nav.getByRole('link', { name: 'News', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /more/i }).click()
    // ...and present once it is open.
    await expect(nav.getByRole('link', { name: 'News', exact: true })).toBeVisible()
  })

  test('the redundant Home entry is gone (the wordmark already links home)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /more/i }).click()
    await expect(page.locator('nav').first().getByRole('link', { name: 'Home', exact: true })).toHaveCount(0)
  })

  test('the active state still works for a plain top-level link', async ({ page }) => {
    await page.goto('/events')
    const events = page.locator('nav').first().getByRole('link', { name: 'Events', exact: true })
    await expect(events).toHaveClass(/text-amber-700/)
  })

  // "Get a Birdhouse" is far wider than "News", and at 390px the nav row is tight.
  test('the nav does not overflow a 390px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const metrics = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
      nav: document.querySelector('nav')!.scrollWidth,
    }))
    expect(metrics.doc).toBeLessThanOrEqual(metrics.win)
    expect(metrics.nav).toBeLessThanOrEqual(metrics.win)
  })

  test('the nav does not overflow at 390px in Arabic, where labels run longer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    const metrics = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
      nav: document.querySelector('nav')!.scrollWidth,
    }))
    expect(metrics.doc).toBeLessThanOrEqual(metrics.win)
    expect(metrics.nav).toBeLessThanOrEqual(metrics.win)
  })
})
