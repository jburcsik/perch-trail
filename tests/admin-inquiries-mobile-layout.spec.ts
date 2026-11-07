import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// On mobile the inquiry card's info block (email, date, message preview,
// linked house, edit code) uses the full card width below the action buttons.

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
  await page.route('**/rest/v1/qr_codes**', (r) => r.fulfill({ json: [{ id: 'ABCDE', edit_code: 'X7F2Q9', retired_at: null }] }))
  await page.route('**/rest/v1/settings**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/profile_requests**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/reply_scripts**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true } }))
  await page.route('**/rest/v1/inquiries**', (r) => {
    const active = r.request().url().includes('archived_at=is.null')
    return r.fulfill({
      json: active ? [{
        id: 1, name: 'Ivo Marsh', email: 'ivo@perchtrail.example', message: 'Can I get a birdhouse for my fence?',
        status: 'in_progress', category: 'birdhouse', archived_at: null, created_at: '2026-07-06T14:00:00Z',
        assigned_qr_code_id: 'ABCDE', welcome_sent_at: null,
      }] : [],
    })
  })
}

test.describe('Admin inquiries - mobile card layout', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')
  test.beforeEach(async ({ context }) => { await injectAdminSession(context) })

  test('the linked-house/edit-code info block uses close to the full card width on mobile, not squeezed by the button column', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await stubInquiriesTab(page)
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ivo Marsh')).toBeVisible({ timeout: 20000 })

    const card = page.locator('[data-testid^="expand-btn-"]').first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
    const editCodeLine = page.getByText('Edit code:')

    const cardBox = await card.boundingBox()
    const lineBox = await editCodeLine.boundingBox()
    expect(cardBox).not.toBeNull()
    expect(lineBox).not.toBeNull()

    // The info line extends to at least 80% of the card's inner width.
    const usableWidth = cardBox!.width - 32 // p-4 left+right padding
    expect(lineBox!.width).toBeGreaterThan(usableWidth * 0.8)
  })
})
