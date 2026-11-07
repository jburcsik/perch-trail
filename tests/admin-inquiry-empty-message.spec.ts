import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// An inquiry's message field is optional on the public contact form. An empty
// message renders as placeholder text rather than a blank box.

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
        id: 1, name: 'Ivo Marsh', email: 'ivo@perchtrail.example', message: '',
        status: 'new', category: 'birdhouse', archived_at: null, created_at: '2026-07-13T18:17:46Z',
        assigned_qr_code_id: null, welcome_sent_at: null,
      }] : [],
    })
  })
}

test.describe('Admin inquiries - empty message placeholder', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')
  test.beforeEach(async ({ context }) => { await injectAdminSession(context) })

  test('an inquiry with no message shows placeholder text, not a blank box', async ({ page }) => {
    await stubInquiriesTab(page)
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ivo Marsh')).toBeVisible({ timeout: 20000 })

    // Collapsed preview line shows the placeholder, not empty space.
    await expect(page.getByText('No message included with this request.')).toBeVisible()

    // Expanded Message box shows the same placeholder.
    await page.click('[data-testid="expand-btn-1"]')
    const messageBox = page.locator('[data-testid="notes-section-1"]')
    await expect(messageBox.getByText('No message included with this request.')).toBeVisible()
  })
})
