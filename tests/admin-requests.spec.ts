import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Admin requests (consolidated into /admin tabs)', () => {
  test('unauthenticated visitors are redirected to /admin/login', async ({ page }) => {
    // Requests are tabs on the /admin dashboard.
    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    // Middleware issues a redirect; Playwright follows it, so assert the login URL.
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 })
    expect(page.url()).toMatch(/\/admin\/login$/)
    // Response may be the login page's 200, not the original 200
    expect(response?.status()).toBeLessThan(500)
  })

  test('POST /api/admin/requests/:id without a session returns 401', async ({ request }) => {
    const res = await request.post('/api/admin/requests/00000000-0000-0000-0000-000000000000', {
      data: { action: 'deny' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/admin/requests/:id rejects unknown actions when unauthenticated (still 401)', async ({ request }) => {
    // Auth check runs first, so even an invalid action gets 401 from the guard
    const res = await request.post('/api/admin/requests/00000000-0000-0000-0000-000000000000', {
      data: { action: 'sabotage' },
    })
    expect(res.status()).toBe(401)
  })
})
