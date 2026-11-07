/**
 * @jest-environment node
 */
import { checkRateLimit, RateLimitPresets, __resetRateLimitForTests } from './rate-limit'

beforeEach(() => {
  __resetRateLimitForTests()
})

describe('checkRateLimit', () => {
  it('allows up to max requests within the window, then rejects', () => {
    const ip = '1.2.3.4'
    const config = { windowMs: 60_000, max: 3 }

    const outcomes = [1, 2, 3, 4, 5].map(() => checkRateLimit(ip, 'test', config).allowed)
    expect(outcomes).toEqual([true, true, true, false, false])
  })

  it('returns a retryAfterSeconds hint when limit is exceeded', () => {
    const ip = '1.2.3.4'
    const config = { windowMs: 60_000, max: 1 }

    checkRateLimit(ip, 'test', config)
    const blocked = checkRateLimit(ip, 'test', config)
    expect(blocked.allowed).toBe(false)
    expect(typeof blocked.retryAfterSeconds).toBe('number')
    expect(blocked.retryAfterSeconds!).toBeGreaterThan(0)
    expect(blocked.retryAfterSeconds!).toBeLessThanOrEqual(60)
  })

  it('keeps separate counters per scope so scopes do not starve each other', () => {
    const ip = '1.2.3.4'
    const config = { windowMs: 60_000, max: 1 }

    expect(checkRateLimit(ip, 'scope-a', config).allowed).toBe(true)
    expect(checkRateLimit(ip, 'scope-b', config).allowed).toBe(true)
    expect(checkRateLimit(ip, 'scope-a', config).allowed).toBe(false)
    expect(checkRateLimit(ip, 'scope-b', config).allowed).toBe(false)
  })

  it('keeps separate counters per IP', () => {
    const config = { windowMs: 60_000, max: 1 }
    expect(checkRateLimit('1.1.1.1', 'test', config).allowed).toBe(true)
    expect(checkRateLimit('2.2.2.2', 'test', config).allowed).toBe(true)
    expect(checkRateLimit('1.1.1.1', 'test', config).allowed).toBe(false)
    expect(checkRateLimit('2.2.2.2', 'test', config).allowed).toBe(false)
  })

  it('the requestForm preset caps at 5/hour', () => {
    expect(RateLimitPresets.requestForm.max).toBe(5)
    expect(RateLimitPresets.requestForm.windowMs).toBe(60 * 60 * 1000)
  })

  it('editVerifyFail (15-minute tier) tolerates a shared IP', () => {
    expect(RateLimitPresets.editVerifyFail.max).toBeGreaterThanOrEqual(60)
    expect(RateLimitPresets.editVerifyFail.windowMs).toBe(15 * 60 * 1000)
  })

  it('editVerifyFailPerMinute catches a fast automated scan within a minute', () => {
    expect(RateLimitPresets.editVerifyFailPerMinute.max).toBeLessThanOrEqual(30)
    expect(RateLimitPresets.editVerifyFailPerMinute.windowMs).toBe(60 * 1000)
  })

  it('the stewardEdit preset is a runaway-script cap far above a human session', () => {
    expect(RateLimitPresets.stewardEdit.max).toBeGreaterThanOrEqual(300)
    expect(RateLimitPresets.stewardEdit.windowMs).toBe(15 * 60 * 1000)
  })

  it('stewardEdit and default scopes do not share a bucket', () => {
    const ip = '5.5.5.5'
    // Burn the default bucket completely.
    for (let i = 0; i < 10; i++) checkRateLimit(ip)
    expect(checkRateLimit(ip).allowed).toBe(false)
    // stewardEdit must still be allowed: separate bucket.
    expect(checkRateLimit(ip, 'stewardEdit', RateLimitPresets.stewardEdit).allowed).toBe(true)
  })

  it('the default scope and config work with no arguments', () => {
    const ip = '9.9.9.9'
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(ip).allowed).toBe(true)
    }
    expect(checkRateLimit(ip).allowed).toBe(false)
  })
})
