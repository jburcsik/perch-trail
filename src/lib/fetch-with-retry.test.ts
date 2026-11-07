/**
 * @jest-environment node
 */
import { fetchWithRateLimitRetry } from './fetch-with-retry'

describe('fetchWithRateLimitRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('returns the response as-is on a non-429 result, without retrying', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(null, { status: 200 }))
    global.fetch = fetchMock

    const res = await fetchWithRateLimitRetry('/api/x', { method: 'POST' })

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('waits for Retry-After (in seconds) then retries exactly once on a 429', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    global.fetch = fetchMock

    const promise = fetchWithRateLimitRetry('/api/x', { method: 'POST' })
    // Only one call so far; the retry is pending on the timer.
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await jest.advanceTimersByTimeAsync(2000)
    const res = await promise

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('caps the wait at 5 seconds even if Retry-After asks for longer', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '900' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    global.fetch = fetchMock

    const promise = fetchWithRateLimitRetry('/api/x', { method: 'POST' })
    await jest.advanceTimersByTimeAsync(5000)
    const res = await promise

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('defaults to a short wait when Retry-After is missing or unparseable', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    global.fetch = fetchMock

    const promise = fetchWithRateLimitRetry('/api/x', { method: 'POST' })
    await jest.advanceTimersByTimeAsync(5000)
    const res = await promise

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries only once: a second 429 is returned as-is, not retried again', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '1' } }))
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '1' } }))
    global.fetch = fetchMock

    const promise = fetchWithRateLimitRetry('/api/x', { method: 'POST' })
    await jest.advanceTimersByTimeAsync(2000)
    const res = await promise

    expect(res.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
