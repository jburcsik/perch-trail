import { test, expect } from '@playwright/test'

// A localized profile page renders the translated house bio via the
// house_translations overlay (src/lib/translation.ts `overlayHouseBios`).
// Runs against a real database and skips when none is configured.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
const CJK = /[\u4E00-\u9FFF]/

function slugToUrl(slug: string) {
  return slug.replace(/\s+/g, '-').toLowerCase()
}

async function rest(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` },
  })
  return res.json()
}

// Pick a real live house that has a slug, coordinates, and a zh-Hans bio
// translation that differs from its English bio. Keeps the test resilient to
// data churn instead of hardcoding a slug.
async function pickTranslatedHouse(): Promise<{ slug: string; en: string; zh: string } | null> {
  if (!SUPABASE_URL || !KEY) return null
  const tx: Array<{ qr_code_id: string; translated_text: string }> = await rest(
    'house_translations?locale=eq.zh-Hans&field=eq.bio&select=qr_code_id,translated_text',
  )
  const zhByHouse = new Map(tx.map((r) => [r.qr_code_id, r.translated_text]))
  const houses: Array<{ qr_code_id: string; slug: string | null; bio: string | null }> = await rest(
    'houses?status=eq.live&archived_at=is.null&suspended_at=is.null&slug=not.is.null&lat=not.is.null&select=qr_code_id,slug,bio',
  )
  for (const h of houses) {
    const zh = h.slug && zhByHouse.get(h.qr_code_id)
    if (h.slug && zh && CJK.test(zh) && zh !== h.bio) {
      return { slug: h.slug, en: h.bio ?? '', zh }
    }
  }
  return null
}

test.describe('profile house-bio localization', () => {
  test('renders the translated bio on the zh-Hans profile page, English on /en', async ({ page }) => {
    const house = await pickTranslatedHouse()
    test.skip(!house, 'No live house with a zh-Hans bio translation available to test against.')
    const slug = slugToUrl(house!.slug)

    // zh-Hans: profile bio should be the Chinese translation (contains CJK).
    await page.goto(`/zh-Hans/v/${slug}`)
    const zhBio = page.getByTestId('profile-bio')
    await expect(zhBio).toBeVisible({ timeout: 15000 })
    await expect(zhBio).toContainText(house!.zh.slice(0, 12))
    const zhText = (await zhBio.textContent()) ?? ''
    expect(CJK.test(zhText)).toBe(true)
    // A translated (non-source) bio shows the friendly "robots translated this" note.
    await expect(page.getByText('\u673A\u5668\u4EBA\u7FFB\u8BD1', { exact: false }).first()).toBeVisible()

    // en: same house, same page, but the original English bio (no overlay).
    await page.goto(`/en/v/${slug}`)
    const enBio = page.getByTestId('profile-bio')
    await expect(enBio).toBeVisible({ timeout: 15000 })
    const enText = (await enBio.textContent()) ?? ''
    expect(enText).not.toBe(zhText)
    expect(CJK.test(enText)).toBe(false)
  })
})
