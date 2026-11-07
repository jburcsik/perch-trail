import { test, expect, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Authenticated admin coverage: signs in as the dedicated test-admin and
// injects the @supabase/ssr session cookie, then verifies the consolidated
// tabbed dashboard renders. Requires TEST_ADMIN_EMAIL/PASSWORD in
// .env.local and that local ADMIN_EMAILS includes the test-admin. Playwright
// doesn't auto-load .env.local, so we read it here.
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

// Stat cards (stubbed REST): Total Houses excludes archived (deleted) and
// invited houses, and the Total Inquiries card is a shortcut to the Inquiries tab.
test.describe('Admin dashboard stat cards', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')

  test.beforeEach(async ({ context }) => {
    await injectAdminSession(context)
  })

  const house = (id: string, status: string, archived_at: string | null = null) => ({
    qr_code_id: id, slug: `${id.toLowerCase()}-house`, status, artist_name: null,
    archived_at, suspended_at: null, pending_edit_id: null,
    auto_approve_edits: false, is_invited_artist: false, include_in_promo: false,
    tags: [], claimed_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
    house_images: [],
  })

  async function stubDashboard(
    page: import('@playwright/test').Page,
    data: { houses: Array<Record<string, unknown>>; inquiries: Array<Record<string, unknown>> }
  ) {
    await page.route('**/rest/v1/houses**', (r) => r.fulfill({ json: data.houses }))
    await page.route('**/rest/v1/inquiries**', (r) => {
      // fetchInquiries makes two calls; only the active one carries archived_at=is.null.
      const active = r.request().url().includes('archived_at=is.null')
      return r.fulfill({ json: active ? data.inquiries : [] })
    })
    await page.route('**/rest/v1/qr_codes**', (r) => r.fulfill({ json: [] }))
    await page.route('**/rest/v1/settings**', (r) => r.fulfill({ json: [] }))
    await page.route('**/rest/v1/profile_requests**', (r) => r.fulfill({ json: [] }))
    await page.route('**/rest/v1/map_markers**', (r) => r.fulfill({ json: [] }))
    await page.route('**/rest/v1/reply_scripts**', (r) => r.fulfill({ json: [] }))
    await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true } }))
  }

  test('Total Houses excludes archived and invited houses', async ({ page }) => {
    await stubDashboard(page, {
      houses: [
        house('AAAAA', 'live'),
        house('BBBBB', 'invited'),                          // placeholder, not a real house yet
        house('CCCCC', 'live', '2026-06-01T00:00:00Z'),     // deleted, a ghost
        house('DDDDD', 'review'),
      ],
      inquiries: [],
    })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('total-houses-count')).toHaveText('2', { timeout: 20000 })
  })

  test('clicking the Total Inquiries card opens the Inquiries tab', async ({ page }) => {
    await stubDashboard(page, {
      houses: [house('AAAAA', 'live')],
      inquiries: [{
        id: 1, name: 'Ivo Marsh', email: 'ivo@perchtrail.example', message: 'How do I get a birdhouse?',
        status: 'new', category: null, archived_at: null, created_at: '2026-07-01T00:00:00Z',
        assigned_qr_code_id: null, welcome_sent_at: null,
      }],
    })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('total-inquiries-card').click({ timeout: 20000 })
    await expect(page).toHaveURL(/tab=inquiries/)
    await expect(page.getByText('Ivo Marsh')).toBeVisible()
  })

  test('clicking the Live Houses card opens the Live tab', async ({ page }) => {
    await stubDashboard(page, { houses: [house('AAAAA', 'live')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('live-houses-card').click({ timeout: 20000 })
    await expect(page).toHaveURL(/tab=live/)
  })

  test('clicking the Invited card opens the Invited tab', async ({ page }) => {
    await stubDashboard(page, { houses: [house('AAAAA', 'invited')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('invited-card').click({ timeout: 20000 })
    await expect(page).toHaveURL(/tab=invited/)
  })

  test('clicking the Ready for Review card opens the Review tab', async ({ page }) => {
    await stubDashboard(page, { houses: [house('AAAAA', 'review')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('review-card').click({ timeout: 20000 })
    await expect(page).toHaveURL(/tab=review/)
  })

  test('Ready for Review card is absent at 0 and present at 1', async ({ page }) => {
    await stubDashboard(page, { houses: [house('AAAAA', 'live')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('review-card')).toHaveCount(0)

    await stubDashboard(page, { houses: [house('AAAAA', 'review')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('review-card')).toBeVisible({ timeout: 20000 })
  })

  test('Live Houses card is absent at 0 and present at 1', async ({ page }) => {
    await stubDashboard(page, { houses: [house('AAAAA', 'review')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('live-houses-card')).toHaveCount(0)

    await stubDashboard(page, { houses: [house('AAAAA', 'live')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('live-houses-card')).toBeVisible({ timeout: 20000 })
  })

  test('Invited card is absent at 0 and present at 1', async ({ page }) => {
    await stubDashboard(page, { houses: [house('AAAAA', 'live')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('invited-card')).toHaveCount(0)

    await stubDashboard(page, { houses: [house('AAAAA', 'invited')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('invited-card')).toBeVisible({ timeout: 20000 })
  })

  test('Total Inquiries card is absent at 0 and present at 1', async ({ page }) => {
    await stubDashboard(page, { houses: [house('AAAAA', 'live')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('total-inquiries-card')).toHaveCount(0)

    await stubDashboard(page, {
      houses: [house('AAAAA', 'live')],
      inquiries: [{
        id: 1, name: 'Ivo Marsh', email: 'ivo@perchtrail.example', message: 'Hi',
        status: 'new', category: null, archived_at: null, created_at: '2026-07-01T00:00:00Z',
        assigned_qr_code_id: null, welcome_sent_at: null,
      }],
    })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('total-inquiries-card')).toBeVisible({ timeout: 20000 })
  })

  test('Suspended pill is absent at 0 suspended houses and present at 1', async ({ page }) => {
    await stubDashboard(page, { houses: [house('AAAAA', 'live')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('admin-tab-suspended')).toHaveCount(0)

    await stubDashboard(page, { houses: [house('AAAAA', 'live'), house('BBBBB', 'suspended')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('admin-tab-suspended')).toBeVisible({ timeout: 20000 })
  })

  test('deep-linking to ?tab=suspended with 0 suspended houses still shows the pill', async ({ page }) => {
    await stubDashboard(page, { houses: [house('AAAAA', 'live')], inquiries: [] })
    await page.goto('/admin?tab=suspended', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('admin-tab-suspended')).toBeVisible()
  })

  test('Total Houses and Total Photos cards are not clickable links', async ({ page }) => {
    await stubDashboard(page, { houses: [house('AAAAA', 'live')], inquiries: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('total-houses-count')).toBeVisible({ timeout: 20000 })

    const totalHousesClickable = await page.getByTestId('total-houses-count').evaluate(
      (el) => el.closest('button, a') !== null
    )
    expect(totalHousesClickable).toBe(false)

    const totalPhotosClickable = await page.getByText('Total Photos').evaluate(
      (el) => el.closest('button, a') !== null
    )
    expect(totalPhotosClickable).toBe(false)
  })
})

test.describe('Admin dashboard (authenticated)', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')

  test.beforeEach(async ({ context }) => {
    await injectAdminSession(context)
  })

  test('renders the tabbed buckets', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('admin-tab-live')).toBeVisible()
    // 'edits' auto-hides at zero pending edits (data-dependent), so don't pin it.
    await expect(page.getByTestId('admin-tab-new')).toBeVisible()
  })

  test('switching to the Edits tab does not crash (when it exists)', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({ timeout: 15000 })
    // The tab auto-hides at zero pending edits, so only exercise it when shown.
    const edits = page.getByTestId('admin-tab-edits')
    if (await edits.count()) {
      await edits.click()
      await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible()
    }
  })
})
