import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Perm-delete from the Deleted tab: yes/no modal only (no typed house name),
// DELETE call carries the confirmation header programmatically. Supabase
// reads and the admin DELETE API are stubbed, so no real rows are touched.

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
  const cookies =
    value.length <= MAX
      ? [{ name, value }]
      : Array.from({ length: Math.ceil(value.length / MAX) }, (_, i) => ({ name: `${name}.${i}`, value: value.slice(i * MAX, (i + 1) * MAX) }))
  await context.addCookies(cookies.map((c) => ({ ...c, url: 'http://localhost:3000' })))
}

const ARCHIVED_HOUSE = {
  qr_code_id: 'ZOMBI',
  slug: 'old-timer',
  status: 'live',
  artist_name: 'Gone Artist',
  archived_at: new Date().toISOString(),
  suspended_at: null,
  pending_edit_id: null,
  auto_approve_edits: false,
  is_invited_artist: false,
  include_in_promo: false,
  tags: [],
  claimed_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  house_images: [],
}

async function stubBackend(page: Page, deletes: Array<{ id: string; confirm: string | null }>) {
  await page.route('**/rest/v1/houses**', (route) => route.fulfill({ json: [ARCHIVED_HOUSE] }))
  await page.route('**/rest/v1/qr_codes**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/settings**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/inquiries**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/profile_requests**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true } }))
  await page.route('**/api/admin/houses/**', (route) => {
    if (route.request().method() === 'DELETE') {
      const id = route.request().url().split('/').pop()!
      deletes.push({ id, confirm: route.request().headers()['x-confirm-slug'] ?? null })
      return route.fulfill({ json: { ok: true } })
    }
    return route.fallback()
  })
}

test.describe('Deleted tab - permanent delete', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')

  test.beforeEach(async ({ context }) => {
    await injectAdminSession(context)
  })

  test('yes/no modal deletes without typing the house name', async ({ page }) => {
    const deletes: Array<{ id: string; confirm: string | null }> = []
    await stubBackend(page, deletes)

    await page.goto('/admin?tab=deleted', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('archived-house-ZOMBI')).toBeVisible({ timeout: 20000 })

    await page.getByTestId('perm-delete-ZOMBI').click()
    await expect(page.getByRole('heading', { name: /Delete "old-timer" forever\?/ })).toBeVisible()

    // No typed-confirmation input, just the yes button, immediately enabled.
    await expect(page.getByRole('dialog').locator('input')).toHaveCount(0)
    const confirmBtn = page.getByRole('button', { name: 'Yes, delete forever' })
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()

    await expect(page.getByText(/Deleted permanently/)).toBeVisible({ timeout: 10000 })
    // The API contract still got its confirmation token, supplied for the user.
    expect(deletes).toEqual([{ id: 'ZOMBI', confirm: 'ZOMBI' }])
  })

  test('cancel deletes nothing', async ({ page }) => {
    const deletes: Array<{ id: string; confirm: string | null }> = []
    await stubBackend(page, deletes)

    await page.goto('/admin?tab=deleted', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('perm-delete-ZOMBI')).toBeVisible({ timeout: 20000 })
    await page.getByTestId('perm-delete-ZOMBI').click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(deletes).toHaveLength(0)
  })
})
