import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// The "Add internal note" composer starts collapsed behind a disclosure.

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

async function stubInquiriesTab(page: Page) {
  await page.route('**/rest/v1/houses**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/qr_codes**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/settings**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/profile_requests**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/reply_scripts**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true } }))
  await page.route('**/rest/v1/inquiry_comments**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/inquiries**', (r) => {
    const active = r.request().url().includes('archived_at=is.null')
    return r.fulfill({
      json: active ? [{
        id: 1, name: 'Ivo Marsh', email: 'ivo@perchtrail.example', message: 'Can I get a birdhouse for my fence?',
        status: 'new', category: null, archived_at: null, created_at: '2026-07-06T14:00:00Z',
        assigned_qr_code_id: null, welcome_sent_at: null,
      }] : [],
    })
  })
}

test.describe('Admin inquiries - internal note composer disclosure', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')
  test.beforeEach(async ({ context }) => { await injectAdminSession(context) })

  test('note composer stays collapsed until opened, and reveals the note controls', async ({ page }) => {
    await stubInquiriesTab(page)
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ivo Marsh')).toBeVisible({ timeout: 20000 })

    await page.click('[data-testid="expand-btn-1"]')
    await expect(page.locator('[data-testid="notes-section-1"]')).toBeVisible()

    // Reply composer is visible immediately (the common action)...
    await expect(page.getByPlaceholder(/Thanks for reaching out/)).toBeVisible()

    // ...but the note composer is not, until its disclosure is opened.
    const opener = page.locator('[data-testid="open-note-composer-1"]')
    await expect(opener).toBeVisible()
    await expect(page.locator('[data-testid="comment-input-1"]')).not.toBeVisible()

    await opener.click()
    await expect(page.locator('[data-testid="comment-input-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="add-comment-btn-1"]')).toBeVisible()
    await expect(opener).not.toBeVisible()
  })
})
