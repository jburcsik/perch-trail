import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// A house that goes live without admin review (auto-approved first edit, or
// a no-moderation claim) is flagged via houses.unreviewed_publish_at. It shows
// as a header badge and a row pill in the Live tab; "Got it" on either clears
// the flag.

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
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`)
  const value = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url')
  const name = `sb-${ref}-auth-token`
  const MAX = 3180
  const cookies = value.length <= MAX ? [{ name, value }] : Array.from({ length: Math.ceil(value.length / MAX) }, (_, i) => ({ name: `${name}.${i}`, value: value.slice(i * MAX, (i + 1) * MAX) }))
  await context.addCookies(cookies.map((c) => ({ ...c, url: 'http://localhost:3000' })))
}

function initialHouses() {
  return [
    {
      qr_code_id: 'ABCDE', slug: 'auto-house', status: 'live', house_images: [],
      artist_name: 'Auto Approved', unreviewed_publish_at: '2026-07-12T10:00:00Z', unreviewed_publish_source: 'auto_approve_edit',
      auto_approve_edits: true, claimed_at: '2026-07-06T14:00:00Z', updated_at: '2026-07-12T10:00:00Z',
    },
    {
      qr_code_id: 'FGHIJ', slug: 'reviewed-house', status: 'live', house_images: [],
      artist_name: 'Reviewed By Admin', unreviewed_publish_at: null, unreviewed_publish_source: null,
      auto_approve_edits: false, claimed_at: '2026-07-05T14:00:00Z', updated_at: '2026-07-05T14:00:00Z',
    },
  ]
}

// Stateful stub: a PATCH mutates the in-memory fixture so a subsequent
// refetch (the app calls fetchHouses() after acknowledging) reflects it,
// same as the real Supabase table would.
async function stubAdminTabs(page: Page, opts: { patched: Array<Record<string, unknown>> }) {
  const houses = initialHouses()
  await page.route('**/rest/v1/settings**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/profile_requests**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/reply_scripts**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/inquiries**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true } }))
  await page.route('**/rest/v1/qr_codes**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/houses**', (r) => {
    const method = r.request().method()
    if (method === 'PATCH') {
      const patch = r.request().postDataJSON()
      opts.patched.push(patch)
      const url = new globalThis.URL(r.request().url())
      const targetId = url.searchParams.get('qr_code_id')?.replace(/^eq\./, '')
      const target = houses.find(h => h.qr_code_id === targetId)
      if (target) Object.assign(target, patch)
      return r.fulfill({ json: target ? [target] : [] })
    }
    return r.fulfill({ json: houses })
  })
}

test.describe('Admin - live-house notifications', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')
  test.beforeEach(async ({ context }) => { await injectAdminSession(context) })

  test('shows a header badge and a row pill for a house published without review, and acknowledging clears both', async ({ page }) => {
    const patched: Array<Record<string, unknown>> = []
    await stubAdminTabs(page, { patched })
    await page.goto('/admin?tab=live', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('auto-house')).toBeVisible({ timeout: 20000 })

    // Header badge shows a count of 1.
    const badge = page.locator('[data-testid="unreviewed-publish-badge"]')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('1')

    // Row pill on the affected house only.
    await expect(page.locator('[data-testid="unreviewed-pill-ABCDE"]')).toBeVisible()
    await expect(page.locator('[data-testid="unreviewed-pill-FGHIJ"]')).toHaveCount(0)

    // Acknowledging from the row pill clears the DB field and the pill disappears.
    await page.click('[data-testid="unreviewed-pill-ABCDE"]')
    await expect(page.locator('[data-testid="unreviewed-pill-ABCDE"]')).toHaveCount(0)
    await expect(badge).toHaveCount(0)
    expect(patched.some(p => p.unreviewed_publish_at === null && p.unreviewed_publish_source === null)).toBe(true)
  })

  test('the badge dropdown lists the house and "Got it" acknowledges it there too', async ({ page }) => {
    const patched: Array<Record<string, unknown>> = []
    await stubAdminTabs(page, { patched })
    await page.goto('/admin?tab=live', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('auto-house')).toBeVisible({ timeout: 20000 })

    await page.click('[data-testid="unreviewed-publish-badge"]')
    const dropdown = page.locator('[data-testid="unreviewed-publish-dropdown"]')
    await expect(dropdown).toBeVisible()
    await expect(dropdown.getByText('Auto Approved')).toBeVisible()

    await page.click('[data-testid="unreviewed-ack-ABCDE"]')
    await expect(page.locator('[data-testid="unreviewed-publish-badge"]')).toHaveCount(0)
    expect(patched.some(p => p.unreviewed_publish_at === null)).toBe(true)
  })
})
