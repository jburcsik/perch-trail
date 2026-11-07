import { test, expect } from '@playwright/test'
import { PERCH_UPDATES, sortNewestFirst, latestUpdates } from '../src/content/perch-updates'

// Expectations are derived from PERCH_UPDATES using the very helpers the page
// uses, never hardcoded post titles: pinning a post title means the suite
// breaks the moment a post is published. Per-post rendering is unit-tested in
// src/components/PerchUpdateCard.test.tsx; these specs cover the page, nav
// and homepage wiring.
const NEWEST = sortNewestFirst(PERCH_UPDATES)
const TEASER = latestUpdates(PERCH_UPDATES, 3)

test.describe('News from the Perch', () => {
  test.skip(PERCH_UPDATES.length === 0, 'No posts in src/content/perch-updates.ts')

  test('/news renders all posts newest-first', async ({ page }) => {
    await page.goto('/en/news')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const headings = page.locator('h2')
    const firstHeadingText = await headings.first().textContent()
    const lastHeadingText = await headings.last().textContent()
    expect(firstHeadingText).toContain(NEWEST[0].title.en)
    expect(lastHeadingText).toContain(NEWEST[NEWEST.length - 1].title.en)
    await expect(headings).toHaveCount(PERCH_UPDATES.length)
  })

  test('each post card has its slug as an anchor id', async ({ page }) => {
    await page.goto('/en/news')
    for (const post of PERCH_UPDATES) {
      await expect(page.locator(`#${post.slug}`)).toBeVisible()
    }
  })

  test('nav reaches /news from the More menu', async ({ page }) => {
    await page.goto('/en')
    await page.getByRole('button', { name: /more/i }).click()
    const link = page.locator('nav').first().getByRole('link', { name: 'News', exact: true })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /\/news$/)
    await link.click()
    await expect(page).toHaveURL(/\/news$/)
  })

  test('homepage shows the news teaser with the 3 most recent posts, linking to /news', async ({ page }) => {
    await page.goto('/en')
    const teaser = page.getByTestId('news-teaser')
    await expect(teaser).toBeVisible()
    for (const post of TEASER) {
      await expect(teaser.getByRole('heading', { name: post.title.en })).toBeVisible()
    }
    // Only the 3 most recent: a 4th-newest post must not appear in the teaser.
    const excluded = NEWEST[3]
    if (excluded) {
      await expect(teaser.getByRole('heading', { name: excluded.title.en })).toHaveCount(0)
    }

    await teaser.getByRole('link', { name: /see all updates/i }).click()
    await expect(page).toHaveURL(/\/news$/)
  })

  test('/news renders in French too', async ({ page }) => {
    await page.goto('/fr/news')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: NEWEST[0].title.fr })).toBeVisible()
  })
})
