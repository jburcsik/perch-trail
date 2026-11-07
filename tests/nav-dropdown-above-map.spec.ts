import { test, expect, type Page } from '@playwright/test'

// The nav dropdowns must stay clickable over /map. `overflow-x: hidden` on
// html/body would compute overflow-y to `auto`, making the body a scroll
// container that clips on both axes; on /map the body is only the nav's
// height because the page is `fixed`. `overflow-x: clip` never creates a
// scroll container.

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
]

/** Every visible item in the open menu must be the topmost element at its own
 *  centre - i.e. actually clickable, not clipped away or painted over. */
async function assertMenuFullyHittable(page: Page, menuName: string) {
  const button = page.getByRole('button', { name: menuName })
  await button.first().click()

  const result = await page.evaluate(() => {
    const open = [...document.querySelectorAll('nav div.absolute')].filter(
      (el) => el.getBoundingClientRect().height > 0
    )
    const menu = open[open.length - 1]
    if (!menu) return null
    const items = [...menu.children]
      .map((child) => {
        const r = child.getBoundingClientRect()
        if (r.height === 0) return null // hidden at this breakpoint
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return { text: child.textContent?.trim().slice(0, 20) ?? '', hittable: menu.contains(hit) }
      })
      .filter((x): x is { text: string; hittable: boolean } => x !== null)
    return { count: items.length, blocked: items.filter((i) => !i.hittable).map((i) => i.text) }
  })

  expect(result, `${menuName} menu did not open`).not.toBeNull()
  expect(result!.count).toBeGreaterThan(1)
  expect(result!.blocked, `${menuName} items clipped or covered`).toEqual([])
  await button.first().click()
}

for (const vp of VIEWPORTS) {
  test.describe(`nav dropdowns on /map (${vp.label})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('every dropdown item is clickable over the map and gallery panel', async ({ page }) => {
      await page.goto('/map')
      // The map must be up for the menus to overlap it.
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 })

      await assertMenuFullyHittable(page, 'More')
      await assertMenuFullyHittable(page, 'Language')
    })
  })
}

test('html/body clip horizontally without becoming a scroll container', async ({ page }) => {
  await page.goto('/map')
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 })

  const overflow = await page.evaluate(() => {
    const b = getComputedStyle(document.body)
    const h = getComputedStyle(document.documentElement)
    return { bodyX: b.overflowX, bodyY: b.overflowY, htmlX: h.overflowX, htmlY: h.overflowY }
  })
  // `hidden` here would re-introduce the vertical clipping.
  expect(overflow.bodyX).toBe('clip')
  expect(overflow.htmlX).toBe('clip')
  expect(overflow.bodyY).toBe('visible')
  expect(overflow.htmlY).toBe('visible')
})

test('no horizontal document overflow in RTL', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ar/map')
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 })

  const doc = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(doc.dir).toBe('rtl')
  expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth)
})
