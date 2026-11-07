// In-memory, per-process rate limiting. Buckets are per scope and IP and do
// not survive a restart or span instances; see the README limits section.
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const DEFAULT_CONFIG = { windowMs: 15 * 60 * 1000, max: 10 } as const

export type RateLimitConfig = { windowMs: number; max: number }

// Named presets for well-known scopes. Each scope is a separate bucket per IP.
export const RateLimitPresets = {
  default: DEFAULT_CONFIG,
  // Public profile-request form.
  requestForm: { windowMs: 60 * 60 * 1000, max: 5 },
  // Edit-code recovery; success and failure both count.
  recovery: { windowMs: 60 * 60 * 1000, max: 3 },
  // Likes; the client also dedupes by cookie.
  likes: { windowMs: 60 * 1000, max: 30 },
  // Steward editing after the code has been verified; a backstop against runaway scripts.
  stewardEdit: { windowMs: 15 * 60 * 1000, max: 300 },
  // Failed edit-code attempts on /verify; only failures count. Two tiers: the
  // per-minute cap stops a fast scan, the 15-minute cap tolerates a shared IP.
  editVerifyFail: { windowMs: 15 * 60 * 1000, max: 60 },
  editVerifyFailPerMinute: { windowMs: 60 * 1000, max: 15 },
} as const

export function checkRateLimit(
  ip: string,
  scope = 'default',
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now()
  const key = `${scope}:${ip}`
  const entry = buckets.get(key)

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true }
  }

  entry.count++

  if (entry.count > config.max) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  return { allowed: true }
}

// Read-only check that does not count this call; used when only some outcomes consume budget.
export function peekRateLimit(
  ip: string,
  scope = 'default',
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now()
  const entry = buckets.get(`${scope}:${ip}`)
  if (!entry || now > entry.resetAt) return { allowed: true }
  if (entry.count > config.max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { allowed: true }
}

// Test helper.
export function __resetRateLimitForTests() {
  buckets.clear()
}

// Drop expired buckets once a minute; unref so the timer never keeps the process alive.
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) {
      buckets.delete(key)
    }
  }
}, 60 * 1000)

if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref()
}
