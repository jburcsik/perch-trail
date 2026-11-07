import { test, expect, type Page } from '@playwright/test'

// Typography invariants. English pages render in Geist and Arabic pages in
// the Arabic pairing (El Messiri headings, IBM Plex Sans Arabic body). Both
// Arabic faces carry Latin glyphs, so a `font-family` declaration alone does
// not prove which face painted; these tests read the resolved platform font
// via CDP (CSS.getPlatformFontsForNode), the same data as the DevTools
// "Rendered Fonts" panel.

const ARABIC_FACES = /El Messiri|IBM Plex Sans Arabic/i

/** The font(s) the browser actually rasterised for the first node matching `selector`. */
async function renderedFonts(page: Page, selector: string): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument')
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector })
  expect(nodeId, `selector ${selector} not found`).toBeTruthy()
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  await cdp.detach()
  // Ignore zero-glyph entries: a face can be listed without contributing glyphs.
  return fonts.filter((f) => f.glyphCount > 0).map((f) => f.familyName)
}

test.describe('typography invariants', () => {
  // CDP is Chromium-only; the invariant is font resolution, not engine-specific.
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP required')

  test('English headings render in Geist, NOT the Arabic display face', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h1')).toBeVisible()

    const fonts = await renderedFonts(page, 'h1')
    expect(fonts.join(', ')).not.toMatch(ARABIC_FACES)
    expect(fonts.join(', ')).toMatch(/Geist/i)
  })

  test('English body copy renders in Geist, NOT the Arabic text face', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('p').first()).toBeVisible()

    const fonts = await renderedFonts(page, 'p')
    expect(fonts.join(', ')).not.toMatch(ARABIC_FACES)
    expect(fonts.join(', ')).toMatch(/Geist/i)
  })

  test('English pages download no Arabic font files', async ({ page }) => {
    // Arabic font files must not be fetched on English pages.
    const fontRequests: string[] = []
    page.on('response', (r) => {
      if (/\.(woff2?|ttf|otf)(\?|$)/.test(r.url())) fontRequests.push(r.url())
    })
    await page.goto('/')
    // Bounded settle rather than networkidle, which is unreliable with long-lived connections.
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)

    // A budget, not zero: Geist and Noto legitimately load (2 to 4 files).
    // Double digits means the Arabic faces are being pulled in.
    expect(fontRequests.length).toBeLessThan(10)
  })

  test('Arabic page renders in the Arabic pairing', async ({ page }) => {
    await page.goto('/ar')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h2').first()).toBeVisible()

    // h2, not h1: the h1 is the Latin wordmark on every locale.
    const heading = await renderedFonts(page, 'h2')
    expect(heading.join(', ')).toMatch(/El Messiri/i)

    const body = await renderedFonts(page, 'p')
    expect(body.join(', ')).toMatch(/IBM Plex Sans Arabic/i)
  })

  test('the RTL line-height bump applies to Arabic only', async ({ page }) => {
    await page.goto('/')
    const ltr = await page.locator('html').evaluate((e) => getComputedStyle(e).lineHeight)
    await page.goto('/ar')
    const rtl = await page.locator('html').evaluate((e) => getComputedStyle(e).lineHeight)
    expect(ltr).not.toBe(rtl)
  })
})
