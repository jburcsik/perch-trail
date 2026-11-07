import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Access code recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/recover', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('recover-form').waitFor({ state: 'visible' })
  })

  test('page renders with the expected fields and CTA', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /lost your access code/i })).toBeVisible()
    await expect(page.getByPlaceholder(/\/h\/ABC12/i)).toBeVisible()
    await expect(page.getByPlaceholder(/the email you used/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /send me a new code/i })).toBeVisible()
  })

  test('submits empty form is blocked client-side (no network request)', async ({ page }) => {
    const requestsToApi: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/recover')) requestsToApi.push(req.url())
    })

    const submit = page.getByRole('button', { name: /send me a new code/i })
    if (await submit.isEnabled()) {
      await submit.click()
      await page.waitForTimeout(400)
    }

    expect(requestsToApi).toHaveLength(0)
  })

  // The parser and rate limiter are unit-tested in src/lib/profile-url.test.ts
  // and src/lib/rate-limit.test.ts.
})
