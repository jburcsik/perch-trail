import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { VALIDATION_MESSAGE } from '../src/components/admin/ReplyScriptsPanel'

// Reply-scripts content manager: the "Email scripts" dashboard box and its
// tab let the admin add, edit and delete reusable canned replies.
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

const house = (id: string, status: string) => ({
  qr_code_id: id, slug: `${id.toLowerCase()}-house`, status, artist_name: null,
  archived_at: null, suspended_at: null, pending_edit_id: null,
  auto_approve_edits: false, is_invited_artist: false, include_in_promo: false,
  tags: [], claimed_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
  house_images: [],
})

async function stubDashboard(
  page: Page,
  data: {
    houses?: Array<Record<string, unknown>>
    inquiries?: Array<Record<string, unknown>>
    scripts?: Array<Record<string, unknown>>
  }
) {
  await page.route('**/rest/v1/houses**', (r) => r.fulfill({ json: data.houses ?? [house('AAAAA', 'live')] }))
  await page.route('**/rest/v1/inquiries**', (r) => {
    const active = r.request().url().includes('archived_at=is.null')
    return r.fulfill({ json: active ? (data.inquiries ?? []) : [] })
  })
  await page.route('**/rest/v1/reply_scripts**', (r) => r.fulfill({ json: data.scripts ?? [] }))
  await page.route('**/rest/v1/qr_codes**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/settings**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/profile_requests**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/map_markers**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true } }))
}

const script1 = { id: '11111111-1111-1111-1111-111111111111', label: 'Pick up offer', body: 'Come grab one!', sort_order: 0 }
const script2 = { id: '22222222-2222-2222-2222-222222222222', label: 'Follow up', body: 'Just checking in.', sort_order: 1 }

test.describe('Admin reply-scripts manager', () => {
  test.skip(!URL || !ANON || !EMAIL || !PASSWORD, 'Supabase/test-admin env not set in .env.local')

  test.beforeEach(async ({ context }) => {
    await injectAdminSession(context)
  })

  test('Email scripts box is visible at 0 scripts and navigates to the scripts tab', async ({ page }) => {
    await stubDashboard(page, { scripts: [] })
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('email-scripts-card')).toBeVisible({ timeout: 20000 })
    await page.getByTestId('email-scripts-card').click()
    await expect(page).toHaveURL(/tab=scripts/)
    await expect(page.getByTestId('reply-scripts-panel')).toBeVisible()
  })

  test('lists stubbed scripts in sort_order order', async ({ page }) => {
    // The stubbed REST endpoint returns the fixture array verbatim (it doesn't
    // actually evaluate `order=` query params), so this pins two things
    // separately: (1) fetchReplyScripts requests the right ascending order,
    // and (2) the panel renders whatever order it's given without reshuffling.
    await stubDashboard(page, {})
    await page.route('**/rest/v1/reply_scripts**', (r) => r.fulfill({ json: [script1, script2] }))
    const orderedRequest = page.waitForRequest((req) => req.url().includes('/rest/v1/reply_scripts') && req.url().includes('order=sort_order.asc'))
    await page.goto('/admin?tab=scripts', { waitUntil: 'domcontentloaded' })
    await orderedRequest
    const list = page.getByTestId('reply-scripts-list')
    await expect(list).toBeVisible({ timeout: 20000 })

    // Scope to direct children: edit and delete buttons inside each row also
    // start with "reply-script-" and would otherwise get swept in too.
    const rows = list.locator(':scope > [data-testid^="reply-script-"]')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toHaveAttribute('data-testid', `reply-script-${script1.id}`)
    await expect(rows.nth(1)).toHaveAttribute('data-testid', `reply-script-${script2.id}`)
  })

  test('creating a script sends the right POST payload and shows the new row', async ({ page }) => {
    await stubDashboard(page, { scripts: [] })
    await page.goto('/admin?tab=scripts', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('reply-scripts-panel')).toBeVisible({ timeout: 20000 })

    let postBody: Record<string, unknown> | null = null
    await page.route('**/rest/v1/reply_scripts**', async (r) => {
      if (r.request().method() === 'POST') {
        postBody = r.request().postDataJSON()
        return r.fulfill({ json: { ...postBody, id: 'new-id-1' } })
      }
      return r.fulfill({ json: [] })
    })

    await page.getByTestId('reply-script-new-label').fill('Thank you')
    await page.getByTestId('reply-script-new-body').fill('Thanks so much!')
    await page.getByTestId('reply-script-new-save').click()

    await expect(async () => {
      expect(postBody).toMatchObject({ label: 'Thank you', body: 'Thanks so much!' })
    }).toPass({ timeout: 10000 })
  })

  test('a new script is appended after the highest existing sort_order, not scripts.length', async ({ page }) => {
    // Simulates a gap left by a prior deletion: two scripts survive but their
    // sort_order values (0, 5) don't match their count (2), so a naive
    // `scripts.length` would wrongly assign sort_order 2, inserting the new
    // script ahead of the one at sort_order 5.
    const gappedScripts = [script1, { ...script2, sort_order: 5 }]
    await stubDashboard(page, { scripts: gappedScripts })
    await page.goto('/admin?tab=scripts', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('reply-scripts-panel')).toBeVisible({ timeout: 20000 })

    let postBody: Record<string, unknown> | null = null
    await page.route('**/rest/v1/reply_scripts**', async (r) => {
      if (r.request().method() === 'POST') {
        postBody = r.request().postDataJSON()
        return r.fulfill({ json: { ...postBody, id: 'new-id-2' } })
      }
      // Keep serving the gapped fixture; returning [] would reset the panel's state.
      return r.fulfill({ json: gappedScripts })
    })

    await page.getByTestId('reply-script-new-label').fill('Thank you')
    await page.getByTestId('reply-script-new-body').fill('Thanks so much!')
    await page.getByTestId('reply-script-new-save').click()

    await expect(async () => {
      expect(postBody).toMatchObject({ sort_order: 6 })
    }).toPass({ timeout: 10000 })
  })

  test('empty label or body blocks save with the exact validation message', async ({ page }) => {
    await stubDashboard(page, { scripts: [] })
    await page.goto('/admin?tab=scripts', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('reply-scripts-panel')).toBeVisible({ timeout: 20000 })

    let postFired = false
    await page.route('**/rest/v1/reply_scripts**', async (r) => {
      if (r.request().method() === 'POST') postFired = true
      return r.fulfill({ json: [] })
    })

    // Body filled, label empty.
    await page.getByTestId('reply-script-new-body').fill('Some body text')
    await page.getByTestId('reply-script-new-save').click()

    await expect(
      page.getByText(VALIDATION_MESSAGE)
    ).toBeVisible()
    expect(postFired).toBe(false)
  })

  test('deleting a script: canceling the confirm dialog does not fire DELETE, confirming does', async ({ page }) => {
    await stubDashboard(page, { scripts: [script1] })
    await page.goto('/admin?tab=scripts', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId(`reply-script-${script1.id}`)).toBeVisible({ timeout: 20000 })

    let deleteFired = false
    await page.route('**/rest/v1/reply_scripts**', async (r) => {
      if (r.request().method() === 'DELETE') deleteFired = true
      return r.fulfill({ json: [] })
    })

    await page.getByTestId(`reply-script-delete-${script1.id}`).click()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    expect(deleteFired).toBe(false)

    await page.getByTestId(`reply-script-delete-${script1.id}`).click()
    await page.getByRole('button', { name: 'Delete' }).last().click()
    await expect(async () => expect(deleteFired).toBe(true)).toPass({ timeout: 10000 })
  })

  test('editing a script: blank label/body blocks save, valid edit sends the update payload', async ({ page }) => {
    await stubDashboard(page, { scripts: [script1] })
    await page.goto('/admin?tab=scripts', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId(`reply-script-${script1.id}`)).toBeVisible({ timeout: 20000 })

    let patchBody: Record<string, unknown> | null = null
    await page.route('**/rest/v1/reply_scripts**', async (r) => {
      if (r.request().method() === 'PATCH') {
        patchBody = r.request().postDataJSON()
        return r.fulfill({ json: [{ ...script1, ...patchBody }] })
      }
      return r.fulfill({ json: [] })
    })

    await page.getByTestId(`reply-script-edit-${script1.id}`).click()
    const row = page.getByTestId(`reply-script-${script1.id}`)
    const labelInput = row.getByPlaceholder('Label')
    const bodyTextarea = row.getByPlaceholder('Body')

    // Blank the label: save must be blocked with the validation message.
    await labelInput.fill('')
    await row.getByRole('button', { name: 'Save' }).click()
    await expect(
      page.getByText(VALIDATION_MESSAGE)
    ).toBeVisible()
    expect(patchBody).toBeNull()

    // Fill in a valid label and save for real.
    await labelInput.fill('Pick up offer (updated)')
    await bodyTextarea.fill('Updated body text.')
    await row.getByRole('button', { name: 'Save' }).click()

    await expect(async () => {
      expect(patchBody).toMatchObject({ label: 'Pick up offer (updated)', body: 'Updated body text.' })
    }).toPass({ timeout: 10000 })
  })

  test('canceling an edit discards changes and leaves the row read-only', async ({ page }) => {
    await stubDashboard(page, { scripts: [script1] })
    await page.goto('/admin?tab=scripts', { waitUntil: 'domcontentloaded' })
    const row = page.getByTestId(`reply-script-${script1.id}`)
    await expect(row).toBeVisible({ timeout: 20000 })

    await page.getByTestId(`reply-script-edit-${script1.id}`).click()
    await row.getByPlaceholder('Label').fill('Should not persist')
    await row.getByRole('button', { name: 'Cancel' }).click()

    await expect(row.getByText(script1.label)).toBeVisible()
    await expect(row.getByPlaceholder('Label')).toHaveCount(0)
  })

  test('inquiry dropdown: selecting a script and clicking Add inserts its body into the reply textarea', async ({ page }) => {
    await stubDashboard(page, {
      scripts: [script1],
      inquiries: [{
        id: 1, name: 'Ivo Marsh', email: 'ivo@perchtrail.example', message: 'How do I get a birdhouse?',
        status: 'new', category: null, archived_at: null, created_at: '2026-07-01T00:00:00Z',
        assigned_qr_code_id: null, welcome_sent_at: null,
      }],
    })
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ivo Marsh')).toBeVisible({ timeout: 20000 })
    await page.getByText('Ivo Marsh').click()

    const scriptSelect = page.locator('select').filter({ hasText: 'Insert a scripted reply' })
    await scriptSelect.selectOption({ label: script1.label })
    await scriptSelect.locator('xpath=following-sibling::button[1]').click()

    await expect(page.locator('textarea').last()).toHaveValue(new RegExp(script1.body))
  })

  test('dropdown+Add row is entirely absent when there are no scripts', async ({ page }) => {
    await stubDashboard(page, {
      scripts: [],
      inquiries: [{
        id: 1, name: 'Ivo Marsh', email: 'ivo@perchtrail.example', message: 'Hi',
        status: 'new', category: null, archived_at: null, created_at: '2026-07-01T00:00:00Z',
        assigned_qr_code_id: null, welcome_sent_at: null,
      }],
    })
    await page.goto('/admin?tab=inquiries', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ivo Marsh')).toBeVisible({ timeout: 20000 })
    await page.getByText('Ivo Marsh').click()

    await expect(page.locator('select').filter({ hasText: 'Insert a scripted reply' })).toHaveCount(0)
  })
})
