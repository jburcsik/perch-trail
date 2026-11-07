/**
 * Cloudflare Turnstile server-side check. When TURNSTILE_SECRET_KEY is unset
 * the check is skipped, so local and test runs need no Cloudflare account.
 */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  })
  const data = await res.json()
  return data.success === true
}
