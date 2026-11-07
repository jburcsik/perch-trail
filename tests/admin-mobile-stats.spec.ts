import { test, expect, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// On mobile there are no stat boxes; navigation happens via the tab pills
// plus a dedicated Street Dots pill.

function env(key: string): string | undefined {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
      if (m && m[1] === key) return m[2].replace(/^"|"$/g, '')
    }
  } catch { /* none */ }
  return undefined
}
const URL = env('NEXT_PUBLIC_SUPABASE_URL')
const ANON = env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const EMAIL = env('TEST_ADMIN_EMAIL')
const PASSWORD = env('TEST_ADMIN_PASSWORD')
const ref = URL ? new globalThis.URL(URL).hostname.split('.')[0] : ''

async function injectAdminSession(context: BrowserContext) {
  const { data, error } = await createClient(URL!, ANON!).auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! })
  if (error || !data.session) throw new Error(`test-admin sign-in failed: ${error?.message}`)
  const value = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url')
  const name = `sb-${ref}-auth-token`
  const MAX = 3180
  const cookies = value.length <= MAX ? [{ name, value }] : Array.from({ length: Math.ceil(value.length / MAX) }, (_, i) => ({ name: `${name}.${i}`, value: value.slice(i * MAX, (i + 1) * MAX) }))
  await context.addCookies(cookies.map((c) => ({ ...c, url: 'http://localhost:3000' })))
}

test.describe('dashboard stats layout mobile vs desktop', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')
  test.beforeEach(async ({ context }) => { await injectAdminSession(context) })

  test('mobile: no stat boxes or toggle, Street Dots pill navigates to markers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({ timeout: 20000 })

    await expect(page.getByTestId('stats-toggle')).toHaveCount(0)
    await expect(page.getByTestId('street-dots-card')).toBeHidden()

    const pill = page.getByTestId('street-dots-pill')
    await expect(pill).toBeVisible()
    // It navigates to a different page, not a same-page tab, so it must not live
    // inside role="tablist" alongside the real role="tab" buttons (ARIA correctness).
    const insideTablist = await pill.evaluate((el) => el.closest('[role="tablist"]') !== null)
    expect(insideTablist).toBe(false)
    await pill.click()
    await expect(page).toHaveURL(/\/admin\/markers/)
  })

  test('desktop: stats grid visible with no toggle, Street Dots pill hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({ timeout: 20000 })

    await expect(page.getByTestId('stats-toggle')).toHaveCount(0)
    await expect(page.getByTestId('street-dots-card')).toBeVisible()
    await expect(page.getByTestId('street-dots-pill')).toBeHidden()
  })
})
