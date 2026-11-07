import robots from './robots'

/** robots.ts always returns a single rules object, never Next's
 * multi-userAgent array form; narrow once here so every assertion below is
 * fully typed without an `as` cast. */
function singleRules(result: ReturnType<typeof robots>) {
  const { rules } = result
  if (Array.isArray(rules)) throw new Error('expected robots() to return a single rules object, not an array')
  return rules
}

describe('robots', () => {
  it('disallows the bare /admin and /api paths, not /admin/ or /api/', () => {
    const rules = singleRules(robots())
    expect(rules.disallow).toContain('/admin')
    expect(rules.disallow).toContain('/api')
    expect(rules.disallow).not.toContain('/admin/')
    expect(rules.disallow).not.toContain('/api/')
  })

  it('allows everything else', () => {
    const rules = singleRules(robots())
    expect(rules.allow).toBe('/')
  })

  it('points sitemap at /sitemap.xml', () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/)
  })
})
