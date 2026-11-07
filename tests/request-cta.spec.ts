import { test, expect } from '@playwright/test'

// The "Request a birdhouse" CTAs open the birdhouse section of /get-involved.

test.describe('Request a birdhouse CTA', () => {
  test('home CTA opens the birdhouse section of /get-involved', async ({ page }) => {
    await page.goto('/')
    const cta = page.getByTestId('home-request-birdhouse-cta')
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', /\/get-involved\?open=birdhouse$/)

    await cta.click()
    await expect(page).toHaveURL(/\/get-involved\?open=birdhouse$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('the nav "Request a birdhouse" entry goes to the same place', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /more/i }).click()
    const link = page.getByRole('link', { name: /request a birdhouse/i })
    await expect(link).toHaveAttribute('href', /\/get-involved\?open=birdhouse$/)
  })
})
