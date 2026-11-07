import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// The "Pickup Invite Sent" status and the "ready to welcome" highlight after
// 3+ days. The welcome email is never sent automatically: it creates a house
// and invites a steward, so it always needs a click.

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

// Relative to real time, not a fixed anchor: isReadyToWelcome() in the app
// always compares against the real Date.now(), so a hardcoded anchor date
// would silently drift out of sync with these fixtures as time passes.
const days = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

function inquiry(overrides: Record<string, unknown>) {
  return {
    id: 1, name: 'Ivo Marsh', email: 'ivo@perchtrail.example', message: 'Can I get a birdhouse?',
    category: 'birdhouse', archived_at: null, created_at: days(10),
    assigned_qr_code_id: null, welcome_sent_at: null, pickup_invite_sent_at: null,
    status: 'in_progress',
    ...overrides,
  }
}

async function stubInquiries(page: Page, data: Record<string, unknown>[]) {
  await page.route('**/rest/v1/houses**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/qr_codes**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/settings**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/profile_requests**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/reply_scripts**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true } }))
  await page.route('**/rest/v1/inquiries**', (r) => {
    const active = r.request().url().includes('archived_at=is.null')
    return r.fulfill({ json: active ? data : [] })
  })
}

test.describe('Admin inquiries - Pickup Invite Sent status', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')
  test.beforeEach(async ({ context }) => { await injectAdminSession(context) })

  test('the status dropdowns include the new option', async ({ page }) => {
    await stubInquiries(page, [inquiry({})])
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ivo Marsh')).toBeVisible({ timeout: 20000 })

    await expect(page.getByTestId('status-filter').locator('option', { hasText: 'Pickup Invite Sent' })).toHaveCount(1)
    await expect(page.getByTestId('status-select-1').locator('option', { hasText: 'Pickup Invite Sent' })).toHaveCount(1)
  })

  test('setting status to Pickup Invite Sent stamps pickup_invite_sent_at', async ({ page }) => {
    await stubInquiries(page, [inquiry({})])
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ivo Marsh')).toBeVisible({ timeout: 20000 })

    let patchBody: Record<string, unknown> | null = null
    await page.route('**/rest/v1/inquiries**', async (r) => {
      if (r.request().method() === 'PATCH') {
        patchBody = r.request().postDataJSON()
        return r.fulfill({ json: [] })
      }
      return r.fulfill({ json: [] })
    })

    await page.getByTestId('status-select-1').selectOption('pickup_invite_sent')

    await expect(async () => {
      expect(patchBody).toMatchObject({ status: 'pickup_invite_sent' })
      expect(typeof (patchBody as Record<string, unknown>)?.pickup_invite_sent_at).toBe('string')
    }).toPass({ timeout: 10000 })
  })

  test('ready-to-welcome highlight shows after 3+ days in Pickup Invite Sent with no welcome sent', async ({ page }) => {
    await stubInquiries(page, [inquiry({ status: 'pickup_invite_sent', pickup_invite_sent_at: days(4) })])
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('welcome-ready-1')).toBeVisible({ timeout: 20000 })
  })

  test('no highlight before 3 days have elapsed', async ({ page }) => {
    await stubInquiries(page, [inquiry({ status: 'pickup_invite_sent', pickup_invite_sent_at: days(1) })])
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ivo Marsh')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('welcome-ready-1')).toHaveCount(0)
  })

  test('no highlight once status has moved away from Pickup Invite Sent, even if the timestamp is old', async ({ page }) => {
    await stubInquiries(page, [inquiry({ status: 'resolved', pickup_invite_sent_at: days(10) })])
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ivo Marsh')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('welcome-ready-1')).toHaveCount(0)
  })

  test('no highlight once the welcome email has already been sent', async ({ page }) => {
    await stubInquiries(page, [inquiry({ status: 'pickup_invite_sent', pickup_invite_sent_at: days(10), welcome_sent_at: days(2) })])
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ivo Marsh')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('welcome-ready-1')).toHaveCount(0)
  })
})
