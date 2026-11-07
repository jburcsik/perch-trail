import { test, expect } from '@playwright/test'

// A single globe trigger with a dropdown. Labels are each language's own
// native name, not translated into the viewer's locale: a French visitor
// sees "English", not "Anglais".

test.describe('Nav language switcher', () => {
  test('shows a single globe trigger, no flag icons', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByRole('button', { name: /language/i })).toBeVisible()
    await expect(page.locator('nav img[src^="/flags/"]')).toHaveCount(0)
  })

  test('opens a dropdown listing all 4 locales by their native name', async ({ page }) => {
    await page.goto('/en')
    await page.getByRole('button', { name: /language/i }).click()
    await expect(page.getByRole('option', { name: 'English', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Fran\u00E7ais', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Ti\u1EBFng Vi\u1EC7t', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: '\u7B80\u4F53\u4E2D\u6587', exact: true })).toBeVisible()
  })

  test('closes on outside click', async ({ page }) => {
    await page.goto('/en')
    await page.getByRole('button', { name: /language/i }).click()
    await expect(page.getByRole('option', { name: 'Fran\u00E7ais', exact: true })).toBeVisible()
    await page.mouse.click(10, 10)
    await expect(page.getByRole('option', { name: 'Fran\u00E7ais', exact: true })).toBeHidden()
  })

  test('picking a language navigates to that locale', async ({ page }) => {
    await page.goto('/en')
    await page.getByRole('button', { name: /language/i }).click()
    await page.getByRole('option', { name: 'Fran\u00E7ais', exact: true }).click()
    await expect(page).toHaveURL(/\/fr(\/|$)/)
  })
})

// With localePrefix 'as-needed' the default locale (en) is unprefixed. Once
// the NEXT_LOCALE cookie holds another locale, the middleware redirects the
// unprefixed `/` to it, so the English switcher link forces an explicit `/en`
// prefix (getPathname's forcePrefix option) to update the cookie first.
test.describe('Nav language switcher round-trip', () => {
  // Each switch is a full page navigation (so the root layout's lang and dir
  // update), and the globe is server-rendered before React attaches its
  // onClick. Retry the open until hydration has happened.
  async function switchTo(page: import('@playwright/test').Page, label: string) {
    const trigger = page.getByRole('button', { name: /language/i })
    const option = page.getByRole('option', { name: label, exact: true })
    await expect(async () => {
      await trigger.click()
      await expect(option).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 15000 })
    await option.click()
  }

  test('en -> ar -> en -> fr -> en preserves correct locale, lang, and dir at every step', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

    await switchTo(page, '\u0627\u0644\u0639\u0631\u0628\u064A\u0629')
    await expect(page).toHaveURL(/\/ar(\/|$)/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    await switchTo(page, 'English')
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

    await switchTo(page, 'Fran\u00E7ais')
    await expect(page).toHaveURL(/\/fr(\/|$)/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    await switchTo(page, 'English')
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('en')
  })

  test('a fresh visit to / after switching back to English stays English', async ({ page, context }) => {
    await page.goto('/ar')
    await switchTo(page, 'English')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    // Fresh navigation (new tab, same cookie jar) must not fall back to ar.
    const fresh = await context.newPage()
    await fresh.goto('/')
    await expect(fresh.locator('html')).toHaveAttribute('lang', 'en')
    await expect(fresh).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/)
    await fresh.close()
  })

  test('switching locale on a deep link preserves the path, not just the home page', async ({ page }) => {
    await page.goto('/ar/faq')
    await switchTo(page, 'English')
    await expect(page).toHaveURL(/\/faq(\?.*)?$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})
