import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Deleting a dot: the ConfirmDialog must stack above the Leaflet map
// (Leaflet panes sit at z-index 400 to 1000).
//
// Auth: real test-admin sign-in (same mechanism as admin-dashboard.spec.ts)
// because the /admin middleware validates sessions server-side. The
// map_markers REST calls are stubbed in the browser, so no rows are read
// from or written to the real table.

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

const MARKERS = [0, 1, 2].map((i) => ({
  id: `00000000-0000-4000-8000-10000000000${i}`,
  label: `Dot 00${i + 1}`,
  lat: 48.1535 + i * 0.0003,
  lng: 11.5920 + i * 0.0004,
  status: 'active',
  removed_at: null,
  promoted_qr_code_id: null,
  created_at: new Date().toISOString(),
}))

async function stubMarkers(page: Page, deleted: string[]) {
  await page.route('**/rest/v1/map_markers**', (route) => {
    const method = route.request().method()
    if (method === 'DELETE') {
      const m = /id=eq\.([0-9a-f-]+)/.exec(route.request().url())
      if (m) deleted.push(m[1])
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({ json: MARKERS })
  })
}

test.describe('dot delete works over the Leaflet map', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')

  test.beforeEach(async ({ context }) => {
    await injectAdminSession(context)
  })

  test('confirm dialog renders ABOVE the map and deletes the dot', async ({ page }) => {
    const deleted: string[] = []
    await stubMarkers(page, deleted)

    await page.goto('/admin/markers', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('markers-table')).toBeVisible({ timeout: 20000 })
    // Wait for the Leaflet map so the centered dialog genuinely overlaps it.
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 })

    // Select a dot via its table row, then ask to delete it.
    await page.getByRole('cell', { name: 'Dot 001', exact: true }).click()
    await expect(page.getByTestId('marker-editor')).toContainText('Edit dot')
    await page.getByTestId('marker-delete').click()

    await expect(page.getByRole('heading', { name: /Delete "Dot 001"\?/ })).toBeVisible()

    // Radix sets pointer-events:none on the body while a dialog is open, so a
    // successful click does not prove the stacking. Assert the z-index directly:
    // the dialog must beat every Leaflet pane and control (400 to 1000).
    const dialogZ = await page
      .getByRole('dialog')
      .evaluate((el) => parseInt(getComputedStyle(el).zIndex, 10))
    const maxLeafletZ = await page
      .locator('.leaflet-pane, .leaflet-control')
      .evaluateAll((els) =>
        Math.max(0, ...els.map((e) => parseInt(getComputedStyle(e).zIndex || '0', 10) || 0))
      )
    expect(dialogZ).toBeGreaterThan(maxLeafletZ)

    await page.getByRole('button', { name: 'Delete permanently' }).click()

    await expect(page.getByText('Dot deleted')).toBeVisible({ timeout: 10000 })
    expect(deleted).toEqual([MARKERS[0].id])
    // Row is gone from the table; the others remain.
    await expect(page.getByRole('cell', { name: 'Dot 001', exact: true })).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'Dot 002', exact: true })).toBeVisible()
  })

  test('promoted dots render nowhere on the dots page', async ({ page }) => {
    // Stub deliberately IGNORES the query's neq filter and returns a promoted
    // marker anyway; the page's client-side defence must still drop it.
    await page.route('**/rest/v1/map_markers**', (route) =>
      route.fulfill({
        json: [
          ...MARKERS,
          {
            id: '00000000-0000-4000-8000-999999999999',
            label: 'Graduated Dot',
            lat: 48.1563,
            lng: 11.5955,
            status: 'promoted',
            removed_at: null,
            promoted_qr_code_id: 'QRPRO',
            created_at: new Date().toISOString(),
          },
        ],
      })
    )

    await page.goto('/admin/markers', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('markers-table')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 })

    // Not in the table, not on the map, no Promoted filter chip.
    await expect(page.getByText('Graduated Dot')).toHaveCount(0)
    await expect(page.locator('.leaflet-marker-pane .leaflet-marker-icon')).toHaveCount(MARKERS.length)
    await expect(page.getByRole('button', { name: /^Promoted/ })).toHaveCount(0)
    // The three active stubs still show.
    await expect(page.getByRole('cell', { name: 'Dot 001', exact: true })).toBeVisible()
  })

  test('cancel keeps the dot', async ({ page }) => {
    const deleted: string[] = []
    await stubMarkers(page, deleted)

    await page.goto('/admin/markers', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('markers-table')).toBeVisible({ timeout: 20000 })
    await page.getByRole('cell', { name: 'Dot 002', exact: true }).click()
    await page.getByTestId('marker-delete').click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { name: /Delete/ })).toHaveCount(0)
    expect(deleted).toHaveLength(0)
    await expect(page.getByRole('cell', { name: 'Dot 002', exact: true })).toBeVisible()
  })
})
