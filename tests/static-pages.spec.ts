import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Privacy & Terms pages', () => {
  test('Privacy page lists what we collect and the email deletion policy', async ({ page }) => {
    await page.goto('/en/privacy', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: /privacy/i, level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: /what we ask for/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /email/i }).first()).toBeVisible()
    await expect(page.getByText(/we don.*sell your information/i)).toBeVisible()
  })

  test('Terms page loads with the expected sections', async ({ page }) => {
    await page.goto('/en/terms', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: /terms/i, level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: /requesting a profile/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /removing a profile/i })).toBeVisible()
  })

  test('Home page footer links to Privacy and Terms', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' })

    const privacyLink = page.getByRole('link', { name: /^privacy$/i })
    const termsLink = page.getByRole('link', { name: /^terms$/i })

    await expect(privacyLink.first()).toBeVisible()
    await expect(termsLink.first()).toBeVisible()
  })
})
