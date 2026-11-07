import { test, expect, type Page } from '@playwright/test'

// After submitting a get-involved form, point people back to the map with
// copy tailored to why they'd want to look, which keeps the site useful to
// come back to instead of a dead-end thank-you page.

// Deterministic Turnstile: shim the widget script so the form gets a token
// without hitting Cloudflare (same pattern as tests/support-page.spec.ts).
async function shimTurnstile(page: Page) {
  await page.route('**/challenges.cloudflare.com/turnstile/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile = {
        render: (el, opts) => { setTimeout(() => opts.callback('test-token'), 0); return 'w1' },
        reset: () => {}, remove: () => {}, getResponse: () => 'test-token', execute: () => {},
      };
      if (window.onloadTurnstileCallback) window.onloadTurnstileCallback();`,
    })
  )
}

async function stubContactSuccess(page: Page) {
  await page.route('**/api/contact', (r) => r.fulfill({ json: { ok: true } }))
}

async function submitCard(page: Page, cardText: string | RegExp) {
  await shimTurnstile(page)
  await page.goto('/en/get-involved')
  // Target the card by role: the nav also has a "Get a Birdhouse" link, and
  // the cards are buttons.
  const name =
    typeof cardText === 'string'
      ? new RegExp(cardText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : cardText
  await page.getByRole('button', { name }).first().click()
  await page.getByPlaceholder('Your name').fill('Test Person')
  await page.getByPlaceholder('Your email').fill('test@example.com')
  await expect(page.getByRole('button', { name: /send message/i })).toBeEnabled({ timeout: 10000 })
  await page.getByRole('button', { name: /send message/i }).click()
}

test.describe('ContactForm - explore-map CTA after submit', () => {
  test('birdhouse card shows birdhouse-specific map copy and a working /map link', async ({ page }) => {
    await stubContactSuccess(page)
    await submitCard(page, 'Get a birdhouse')
    const cta = page.getByTestId('explore-map-cta')
    await expect(cta).toBeVisible()
    await expect(cta).toContainText('inspiration')
    const link = cta.getByRole('link')
    await expect(link).toHaveAttribute('href', /\/map$/)
  })

  test('perch card shows perch-specific map copy', async ({ page }) => {
    await stubContactSuccess(page)
    await submitCard(page, 'Get a perch page')
    await expect(page.getByTestId('explore-map-cta')).toContainText('perch pages')
  })

  test('host card shows host-specific map copy', async ({ page }) => {
    await stubContactSuccess(page)
    await submitCard(page, 'Host a birdhouse')
    await expect(page.getByTestId('explore-map-cta')).toContainText('trail')
  })

  test('volunteer card shows volunteer-specific map copy', async ({ page }) => {
    await stubContactSuccess(page)
    await submitCard(page, 'Volunteer')
    await expect(page.getByTestId('explore-map-cta')).toContainText('trail')
  })

  test('clicking the map link actually navigates to /map', async ({ page }) => {
    await stubContactSuccess(page)
    await submitCard(page, 'Get a birdhouse')
    await page.getByTestId('explore-map-cta').getByRole('link').click()
    await expect(page).toHaveURL(/\/map$/)
  })
})
