import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Quick Add: in the field, snap-name-save a birdhouse at the current
// GPS position; it lands in Ready for Review. No photo? Drop a dot instead.
// REST writes are stubbed, so nothing touches real tables.

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

const GPS = { latitude: 48.1552, longitude: 11.5909 }
// A real 1x1 PNG: the page compresses the photo in the browser before signing.
const PIXEL_PNG = readFileSync(resolve(__dirname, 'fixtures/pixel.png'))

type Captured = { qr: Array<Record<string, unknown>>; houses: Array<Record<string, unknown>>; markers: Array<Record<string, unknown>> }

async function stubWrites(page: Page): Promise<Captured> {
  const captured: Captured = { qr: [], houses: [], markers: [] }
  await page.route('**/rest/v1/qr_codes**', (route) => {
    if (route.request().method() === 'POST') {
      captured.qr.push(route.request().postDataJSON())
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ json: [] })
  })
  await page.route('**/rest/v1/houses**', (route) => {
    if (route.request().method() === 'POST') {
      captured.houses.push(route.request().postDataJSON())
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ json: [] })
  })
  await page.route('**/rest/v1/map_markers**', (route) => {
    if (route.request().method() === 'POST') {
      captured.markers.push(route.request().postDataJSON())
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ json: [] })
  })
  return captured
}

test.use({ geolocation: GPS, permissions: ['geolocation'], viewport: { width: 390, height: 844 } })

test.describe('quick add', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')
  test.beforeEach(async ({ context }) => { await injectAdminSession(context) })

  test('name + save creates a review house at my GPS position', async ({ page }) => {
    const captured = await stubWrites(page)
    await page.goto('/admin/quick-add', { waitUntil: 'domcontentloaded' })

    // Geolocation lands in the form automatically.
    await expect(page.getByTestId('quick-add-coords')).toContainText('48.155', { timeout: 20000 })

    await page.getByTestId('quick-add-name').fill('Sunny Corner House')
    await page.getByTestId('quick-add-save').click()

    await expect(page.getByTestId('quick-add-success')).toBeVisible({ timeout: 15000 })
    expect(captured.qr).toHaveLength(1)
    expect(captured.houses).toHaveLength(1)
    expect(captured.houses[0]).toMatchObject({ slug: 'sunny-corner-house', status: 'review' })
    expect(captured.houses[0].lat as number).toBeCloseTo(GPS.latitude, 3)
    expect(captured.houses[0].lng as number).toBeCloseTo(GPS.longitude, 3)
  })

  test('nameless save is blocked client-side', async ({ page }) => {
    const captured = await stubWrites(page)
    await page.goto('/admin/quick-add', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('quick-add-coords')).toContainText('48.155', { timeout: 20000 })

    await page.getByTestId('quick-add-save').click()
    await expect(page.getByText(/give it a name/i)).toBeVisible()
    expect(captured.qr).toHaveLength(0)
    expect(captured.houses).toHaveLength(0)
  })

  test('drop-a-dot-instead creates a marker, consumes nothing', async ({ page }) => {
    const captured = await stubWrites(page)
    await page.goto('/admin/quick-add', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('quick-add-coords')).toContainText('48.155', { timeout: 20000 })

    await page.getByTestId('quick-add-name').fill('Blue on the fence')
    await page.getByTestId('quick-add-dot-instead').click()

    await expect(page.getByTestId('quick-add-success')).toBeVisible({ timeout: 15000 })
    expect(captured.markers).toHaveLength(1)
    expect(captured.markers[0]).toMatchObject({ label: 'Blue on the fence' })
    expect(captured.qr).toHaveLength(0)
    expect(captured.houses).toHaveLength(0)
  })

  test('dashboard header links to quick add', async ({ page }) => {
    await stubWrites(page)
    await page.route('**/rest/v1/settings**', (r) => r.fulfill({ json: [] }))
    await page.route('**/rest/v1/inquiries**', (r) => r.fulfill({ json: [] }))
    await page.route('**/rest/v1/profile_requests**', (r) => r.fulfill({ json: [] }))
    await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true } }))
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('quick-add-link')).toBeVisible({ timeout: 20000 })
  })
})

// "Drop a dot where I am" on the dots page.
test('markers page drops a dot at my GPS position', async ({ page, context }) => {
  await injectAdminSession(context)
  const captured = await stubWrites(page)
  await page.goto('/admin/markers', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('markers-toolbar')).toBeVisible({ timeout: 20000 })

  await page.getByTestId('drop-dot-here').click()
  await expect.poll(() => captured.markers.length, { timeout: 10000 }).toBe(1)
  expect(captured.markers[0].lat as number).toBeCloseTo(GPS.latitude, 3)
  expect(captured.markers[0].lng as number).toBeCloseTo(GPS.longitude, 3)
})

// Approving a nameless review house is blocked.
test('approve is blocked for a nameless house', async ({ page, context }) => {
  await injectAdminSession(context)
  const patches: Array<Record<string, unknown>> = []
  await page.route('**/rest/v1/houses**', (route) => {
    const method = route.request().method()
    if (method === 'PATCH') {
      patches.push(route.request().postDataJSON())
      return route.fulfill({ json: [] })
    }
    return route.fulfill({
      json: [{
        qr_code_id: 'NONAM', slug: null, status: 'review', artist_name: 'Field Find',
        archived_at: null, suspended_at: null, pending_edit_id: null,
        auto_approve_edits: false, is_invited_artist: false, include_in_promo: false,
        tags: [], claimed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        house_images: [],
      }],
    })
  })
  await page.route('**/rest/v1/qr_codes**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/settings**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/inquiries**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/profile_requests**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true } }))

  await page.goto('/admin?tab=review', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Approve' }).first().click({ timeout: 20000 })

  await expect(page.getByText(/give it a name first/i)).toBeVisible()
  expect(patches).toHaveLength(0)
})

// Field UX: a pre-taken photo from the library rides the same upload path as
// a fresh camera shot, and the heading has no emoji offsetting the buttons.
test('library picker selects a pre-taken photo and uploads it', async ({ page, context }) => {
  await injectAdminSession(context)
  const captured = await stubWrites(page)
  const records: Array<Record<string, unknown>> = []
  await page.route('**/api/house/images/sign', (route) =>
    route.fulfill({ json: { token: 'tok', path: 'houses/X/1.jpg', storage_path: 'houses/X/1.jpg', image_url: 'https://cdn/x.jpg' } })
  )
  await page.route('**/storage/v1/**', (route) => route.fulfill({ json: { Key: 'houses/X/1.jpg' } }))
  await page.route('**/api/house/images', (route) => {
    records.push(route.request().postDataJSON())
    return route.fulfill({ json: { image: { id: 1 } } })
  })

  await page.goto('/admin/quick-add', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('quick-add-coords')).toContainText('48.155', { timeout: 20000 })

  // The heading carries no emoji.
  await expect(page.getByRole('heading', { name: 'Quick add', exact: true })).toBeVisible()

  // Both entry points exist: shoot a new photo or pick an existing one.
  await expect(page.getByTestId('quick-add-take-photo')).toBeVisible()
  await expect(page.getByTestId('quick-add-choose-photo')).toBeVisible()

  await page.getByTestId('quick-add-photo-library').setInputFiles({
    name: 'from-library.png', mimeType: 'image/png', buffer: PIXEL_PNG,
  })
  await expect(page.getByText('from-library.png')).toBeVisible()

  await page.getByTestId('quick-add-name').fill('Library House')
  await page.getByTestId('quick-add-save').click()

  await expect(page.getByTestId('quick-add-success')).toBeVisible({ timeout: 15000 })
  expect(captured.houses).toHaveLength(1)
  expect(records).toHaveLength(1)
  expect(records[0]).toMatchObject({ display_order: 1, storage_path: 'houses/X/1.jpg', image_url: 'https://cdn/x.jpg' })
})

// The photo path: sign, direct storage upload, database record.
test('photo rides the signed-URL path and records display_order 1', async ({ page, context }) => {
  await injectAdminSession(context)
  const captured = await stubWrites(page)
  const records: Array<Record<string, unknown>> = []
  await page.route('**/api/house/images/sign', (route) =>
    route.fulfill({ json: { token: 'tok', path: 'houses/X/1.jpg', storage_path: 'houses/X/1.jpg', image_url: 'https://cdn/x.jpg' } })
  )
  await page.route('**/storage/v1/**', (route) => route.fulfill({ json: { Key: 'houses/X/1.jpg' } }))
  await page.route('**/api/house/images', (route) => {
    records.push(route.request().postDataJSON())
    return route.fulfill({ json: { image: { id: 1 } } })
  })

  await page.goto('/admin/quick-add', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('quick-add-coords')).toContainText('48.155', { timeout: 20000 })
  await page.getByTestId('quick-add-name').fill('Photo House')
  await page.getByTestId('quick-add-photo').setInputFiles({ name: 'snap.png', mimeType: 'image/png', buffer: PIXEL_PNG })
  await page.getByTestId('quick-add-save').click()

  await expect(page.getByTestId('quick-add-success')).toBeVisible({ timeout: 15000 })
  expect(captured.houses).toHaveLength(1)
  expect(records).toHaveLength(1)
  expect(records[0]).toMatchObject({ display_order: 1, storage_path: 'houses/X/1.jpg', image_url: 'https://cdn/x.jpg' })
})
