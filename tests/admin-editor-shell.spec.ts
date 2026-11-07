import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// The admin house editor uses the same brand shell and sections as the
// steward editor.

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

const HOUSE = {
  qr_code_id: 'STYLD', slug: 'styled-house', status: 'live', artist_name: 'A',
  artist_bio: null, bio: null, lat: 48.1535, lng: 11.5920, tags: [],
  is_invited_artist: false, include_in_promo: false, auto_approve_edits: false,
  suspended_at: null, suspended_reason: null, archived_at: null, pending_edit_id: null,
  claimed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}

async function stubReads(page: Page) {
  await page.route('**/rest/v1/houses**', (r) => r.fulfill({ json: HOUSE }))
  await page.route('**/rest/v1/house_images**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/profile_requests**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (r) => r.fulfill({ json: null }))
  await page.route('**/rest/v1/qr_codes**', (r) => r.fulfill({ json: [] }))
}

test.describe('admin editor shell', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')
  test.beforeEach(async ({ context }) => { await injectAdminSession(context) })

  test('edit page: brand shell, named title, scannable sections', async ({ page }) => {
    await stubReads(page)
    await page.goto('/admin/houses/STYLD', { waitUntil: 'domcontentloaded' })

    const shell = page.getByTestId('admin-editor-shell')
    await expect(shell).toBeVisible({ timeout: 20000 })
    await expect(shell).toHaveClass(/from-amber-50/)
    await expect(page.getByRole('heading', { name: 'Styled House' })).toBeVisible()

    for (const section of ['Name & story', 'Location', 'Photos', 'Admin controls', 'Danger Zone']) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible()
    }
    // Photos section ships the tile UI (acceptance).
    await expect(page.getByText('0 of 3')).toBeVisible()
    await expect(page.locator('label[for="admin-photo-upload"]')).toBeVisible()

    // Save keeps its exact text; goes amber.
    const save = page.getByRole('button', { name: 'Save Changes' })
    await expect(save).toBeVisible()
    await expect(save).toHaveClass(/bg-amber-600/)
  })

  test('new page: same shell and sections, no danger zone', async ({ page }) => {
    await stubReads(page)
    await page.route('**/rest/v1/qr_codes**', (r) =>
      r.request().method() === 'POST' ? r.fulfill({ status: 201, body: '' }) : r.fulfill({ json: [] })
    )
    await page.goto('/admin/houses/new', { waitUntil: 'domcontentloaded' })

    const shell = page.getByTestId('admin-editor-shell')
    await expect(shell).toBeVisible({ timeout: 20000 })
    await expect(shell).toHaveClass(/from-amber-50/)
    for (const section of ['Name & story', 'Location', 'Admin controls']) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible()
    }
    await expect(page.getByRole('heading', { name: 'Danger Zone' })).toHaveCount(0)
  })
})
