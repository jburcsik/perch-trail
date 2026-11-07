import { test, expect, type Page } from '@playwright/test'

// The /support giving page. E-transfer and card lanes
// are config-gated (hidden until the env supplies the address / Stripe link);
// the quick ping is always on and files into inquiries as a donor category.

// Deterministic Turnstile: shim the widget script so the form gets a token
// without hitting Cloudflare.
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

test('support page renders the pitch, the honesty line, and the ping form', async ({ page }) => {
  await page.goto('/support')
  await expect(page.getByRole('heading', { name: /keep the trail growing/i })).toBeVisible()
  await expect(page.getByText(/not a registered charity/i)).toBeVisible()
  await expect(page.getByTestId('support-ping')).toBeVisible()
  // Both lanes are gated on build-time env (assertions follow this build's env).
  if (process.env.NEXT_PUBLIC_SUPPORT_ETRANSFER) {
    await expect(page.getByTestId('etransfer-lane')).toContainText(process.env.NEXT_PUBLIC_SUPPORT_ETRANSFER)
  } else {
    await expect(page.getByTestId('etransfer-lane')).toHaveCount(0)
  }
  if (process.env.NEXT_PUBLIC_SUPPORT_STRIPE_LINK) {
    await expect(page.getByTestId('card-lane')).toBeVisible()
  } else {
    await expect(page.getByTestId('card-lane')).toHaveCount(0)
  }
})

test('support page renders in French too', async ({ page }) => {
  await page.goto('/fr/support')
  await expect(page.getByText(/organisme de bienfaisance/i)).toBeVisible()
})

test('pledging $25 files a donor inquiry carrying the amount', async ({ page }) => {
  await shimTurnstile(page)
  const posts: Array<Record<string, unknown>> = []
  await page.route('**/api/contact', (route) => {
    posts.push(route.request().postDataJSON())
    return route.fulfill({ json: { ok: true } })
  })

  await page.goto('/support')
  const ping = page.getByTestId('support-ping')
  await ping.locator('input[name="name"]').fill('Generous Neighbour')
  await ping.locator('input[name="email"]').fill('give@example.com')
  await ping.getByTestId('amount-25').click()
  await ping.getByRole('button', { name: /send/i }).click()

  await expect.poll(() => posts.length, { timeout: 10000 }).toBe(1)
  expect(posts[0]).toMatchObject({ role: 'donor', email: 'give@example.com' })
  expect(String(posts[0].message)).toContain('Pledge: $25')
})

test('the Other amount takes a custom value', async ({ page }) => {
  await shimTurnstile(page)
  const posts: Array<Record<string, unknown>> = []
  await page.route('**/api/contact', (route) => {
    posts.push(route.request().postDataJSON())
    return route.fulfill({ json: { ok: true } })
  })

  await page.goto('/support')
  const ping = page.getByTestId('support-ping')
  await ping.locator('input[name="name"]').fill('N')
  await ping.locator('input[name="email"]').fill('n@example.com')
  await ping.getByTestId('amount-other').click()
  await ping.getByTestId('amount-other-input').fill('15')
  await ping.locator('textarea[name="message"]').fill('for brushes')
  await ping.getByRole('button', { name: /send/i }).click()

  await expect.poll(() => posts.length, { timeout: 10000 }).toBe(1)
  const msg = String(posts[0].message)
  expect(msg).toContain('Pledge: $15')
  expect(msg).toContain('for brushes')
})

test('the support page says exactly what happens next', async ({ page }) => {
  await page.goto('/support')
  await expect(page.getByTestId('support-ping')).toContainText(/transfer request/i)
  await expect(page.getByTestId('support-ping')).toContainText(/nothing is charged automatically/i)
})

test('the FAQ links to the give page', async ({ page }) => {
  await page.goto('/faq')
  // Footer contributes exactly one /support anchor; the second is the FAQ
  // answer's inline link.
  const hrefs = await page.locator('a[href*="/support"]').count()
  expect(hrefs).toBeGreaterThan(1)
})

test('comma decimals never inflate a pledge (7,50 stays $7.50)', async ({ page }) => {
  await shimTurnstile(page)
  const posts: Array<Record<string, unknown>> = []
  await page.route('**/api/contact', (route) => {
    posts.push(route.request().postDataJSON())
    return route.fulfill({ json: { ok: true } })
  })

  await page.goto('/support')
  const ping = page.getByTestId('support-ping')
  await ping.locator('input[name="name"]').fill('N')
  await ping.locator('input[name="email"]').fill('n@example.com')
  await ping.getByTestId('amount-other').click()
  await ping.getByTestId('amount-other-input').fill('7,50')
  await ping.getByRole('button', { name: /send/i }).click()

  await expect.poll(() => posts.length, { timeout: 10000 }).toBe(1)
  expect(String(posts[0].message)).toContain('Pledge: $7.50')
  expect(String(posts[0].message)).not.toContain('750')
})

test('nav More menu and footer link to /support', async ({ page }) => {
  await page.goto('/faq')
  await page.getByRole('button', { name: /more/i }).click()
  await expect(page.getByRole('link', { name: /support the trail/i }).first()).toBeVisible()
  await expect(page.locator('footer').getByRole('link', { name: /support the trail/i })).toBeVisible()
})

test('events page points to /support', async ({ page }) => {
  await page.goto('/events')
  // The footer carries the link too, so assert the in-page CTA specifically.
  await expect(page.getByRole('link', { name: /support the trail/i }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /support the trail/i })).toHaveCount(2)
})
