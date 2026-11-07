// One transparent retry on 429, so a steward on a shared IP never sees a
// rate-limit message for ordinary use.
const MAX_WAIT_SECONDS = 5

export async function fetchWithRateLimitRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status !== 429) return res

  const header = res.headers.get('Retry-After')
  const parsed = Number(header)
  const waitSeconds = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_WAIT_SECONDS) : 1

  await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
  return fetch(input, init)
}
