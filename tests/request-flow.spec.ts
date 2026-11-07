import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

// The birdhouse request lives in the "Get a birdhouse" card on /get-involved
// and the retired /request URL redirects there. The CTA reaches the form, the
// honeypot is present but invisible, and an empty submit makes no network call.

test.describe('Request a birdhouse flow', () => {
  test('home CTA points at the get-involved birdhouse section', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' })
    const cta = page.getByTestId('home-request-birdhouse-cta')
    await expect(cta).toBeVisible()
    expect(await cta.getAttribute('href')).toContain('/get-involved?open=birdhouse')
  })

  test('the retired /request URL redirects rather than 404ing', async ({ page }) => {
    await page.goto('/request', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/get-involved\?open=birdhouse$/)
  })

  test.describe('the birdhouse request form', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/get-involved?open=birdhouse', { waitUntil: 'domcontentloaded' })
      await page.getByPlaceholder('Your name').waitFor({ state: 'visible' })
    })

    test('asks for name and email and nothing heavier', async ({ page }) => {
      await expect(page.getByPlaceholder('Your name')).toBeVisible()
      await expect(page.getByPlaceholder('Your email')).toBeVisible()
      await expect(page.getByRole('button', { name: /send message/i })).toBeVisible()
      // No photo upload or map picker in this lightweight flow.
      await expect(page.locator('input[type="file"]')).toHaveCount(0)
    })

    test('honeypot is in the DOM but hidden from real users', async ({ page }) => {
      const honeypot = page.locator('#website')
      await expect(honeypot).toHaveCount(1)
      // NOT toBeVisible(): sr-only keeps a 1x1 clipped box, which Playwright
      // still reports as visible. Assert what sr-only actually guarantees.
      await expect(honeypot.locator('xpath=ancestor::*[@aria-hidden="true"]').first()).toHaveCount(1)
      // Measure the sr-only WRAPPER, not the input: sr-only clips the parent,
      // so the input keeps its own ~194px layout box and asserting on it fails
      // for the wrong reason.
      const clip = await honeypot.evaluate((el) => {
        const p = el.parentElement!
        const r = p.getBoundingClientRect()
        return { w: r.width, h: r.height, x: r.x, overflow: getComputedStyle(p).overflow }
      })
      expect(clip.w).toBeLessThanOrEqual(2)
      expect(clip.h).toBeLessThanOrEqual(2)
      expect(clip.overflow).toBe('hidden')
      // Not an off-canvas offset: a -9999px offset blanks the RTL homepage on
      // first paint.
      expect(clip.x).toBeGreaterThan(-1000)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })

    test('spam and validation gates are in place before anything can be sent', async ({ page }) => {
      test.skip(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, 'NEXT_PUBLIC_TURNSTILE_SITE_KEY not set: the submit button is only Turnstile-gated when a site key is configured')
      const calls: string[] = []
      page.on('request', (r) => {
        if (r.url().includes('/api/contact')) calls.push(r.url())
      })

      // Two independent gates, and it matters which is which:
      //   1. name + email are HTML-required, so the browser blocks submission
      //   2. the submit button is disabled until Turnstile issues a token
      // The button is NOT gated on the fields, so do not assert that it
      // enables once they are filled; in a test browser Turnstile never
      // solves and it stays disabled, which is the correct anti-spam posture.
      await expect(page.getByPlaceholder('Your name')).toHaveAttribute('required', '')
      await expect(page.getByPlaceholder('Your email')).toHaveAttribute('required', '')

      const submit = page.getByRole('button', { name: /send message/i })
      await expect(submit).toBeDisabled()

      await page.getByPlaceholder('Your name').fill('Test Neighbour')
      await page.getByPlaceholder('Your email').fill('neighbour@example.com')
      await page.waitForTimeout(500)

      // Filling fields must never be enough on its own to reach the endpoint.
      expect(calls).toEqual([])
    })
  })
})
