/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { __resetRateLimitForTests, checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'

const fromMock = jest.fn()
const rpcMock = jest.fn(async () => ({ data: 1, error: null }))
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock, rpc: rpcMock }),
}))

import { POST } from './route'

function makeRequest(body: unknown, ip = '4.4.4.4') {
  return new NextRequest('http://localhost/api/house/edit-status', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

function wire(opts: { lockedUntil?: string | null } = {}) {
  fromMock.mockImplementation((table: string) => {
    if (table === 'qr_codes') {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { edit_code: 'CODE', failed_attempts: 0, locked_until: opts.lockedUntil ?? null }, error: null }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }
    }
    if (table === 'profile_requests') {
      return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: 'r1', rejection_note: 'Too short', reviewed_at: '2026-07-01T00:00:00Z' } }) }) }) }) }) }) }) }
    }
    if (table === 'houses') {
      return { select: () => ({ eq: () => ({ single: async () => ({ data: { pending_edit_id: 'p1' } }) }) }) }
    }
    throw new Error(`unexpected table ${table}`)
  })
}

beforeEach(() => { __resetRateLimitForTests(); fromMock.mockReset() })

describe('POST /api/house/edit-status', () => {
  it('returns the pending edit and last denial for a valid code', async () => {
    wire()
    const res = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'CODE' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ pendingEditId: 'p1', lastDenial: { note: 'Too short', reviewedAt: '2026-07-01T00:00:00Z' } })
  })

  it('rejects a wrong code with 403 and records the failure on the code', async () => {
    wire()
    const res = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'WRNG' }))
    expect(res.status).toBe(403)
    expect(rpcMock).toHaveBeenCalledWith('record_edit_code_failure', { p_qr_code_id: 'TEST1' })
  })

  it('returns 429 while the code is locked, even for the correct code', async () => {
    wire({ lockedUntil: new Date(Date.now() + 60_000).toISOString() })
    const res = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'CODE' }))
    expect(res.status).toBe(429)
  })

  it('is covered by the stewardEdit rate limit', async () => {
    wire()
    for (let i = 0; i < RateLimitPresets.stewardEdit.max; i++) checkRateLimit('3.3.3.3', 'stewardEdit', RateLimitPresets.stewardEdit)
    const res = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'CODE' }, '3.3.3.3'))
    expect(res.status).toBe(429)
  })

  it('rejects malformed ids before touching the database', async () => {
    wire()
    const res = await POST(makeRequest({ qr_code_id: 'TOO-LONG-ID', edit_code: 'CODE' }))
    expect(res.status).toBe(403)
    expect(fromMock).not.toHaveBeenCalled()
  })
})
