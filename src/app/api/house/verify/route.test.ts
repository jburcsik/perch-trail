/**
 * @jest-environment node
 *
 * verify returns the house (+images) via the service role so a steward can load
 * and edit a pre-publish house (status invited/review) that anon RLS hides.
 * Wrong codes are throttled per IP in memory and locked per code in the
 * qr_codes row (see src/lib/steward-edit-auth.ts).
 */
import { NextRequest } from 'next/server'
import { __resetRateLimitForTests } from '@/lib/rate-limit'
import { EDIT_CODE_MAX_FAILURES } from '@/lib/steward-edit-auth'

const fromMock = jest.fn()
const rpcMock = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock, rpc: rpcMock }),
}))

import { POST } from './route'

function makeRequest(body: unknown, ip = '6.6.6.6') {
  return new NextRequest('http://localhost/api/house/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

type CodeRow = { edit_code: string; failed_attempts: number; locked_until: string | null; retired_at?: string | null }

/**
 * Stateful qr_codes stub: every id resolves to its own row, and updates from
 * checkEditCode land on that row so lockout state carries between requests.
 */
function wire(opts: { codes?: Record<string, CodeRow>; house: Record<string, unknown> | null; images?: unknown[] }) {
  const { house, images = [] } = opts
  const codes: Record<string, CodeRow> = opts.codes ?? { TEST1: { edit_code: 'CODE', failed_attempts: 0, locked_until: null } }
  rpcMock.mockImplementation(async (_fn: string, args: { p_qr_code_id: string }) => {
    const row = codes[args.p_qr_code_id]
    row.failed_attempts += 1
    return { data: row.failed_attempts, error: null }
  })
  fromMock.mockImplementation((table: string) => {
    if (table === 'qr_codes') {
      return {
        select: () => ({ eq: (_col: string, id: string) => ({ single: async () => ({ data: codes[id] ?? null, error: codes[id] ? null : { message: 'none' } }) }) }),
        update: (patch: Partial<CodeRow>) => ({ eq: async (_col: string, id: string) => { Object.assign(codes[id], patch); return { error: null } } }),
      }
    }
    if (table === 'houses') {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: house, error: null }) }) }) }
    }
    if (table === 'house_images') {
      return { select: () => ({ eq: () => ({ order: async () => ({ data: images, error: null }) }) }) }
    }
    throw new Error(`unexpected table ${table}`)
  })
  return codes
}

beforeEach(() => { __resetRateLimitForTests(); fromMock.mockReset(); rpcMock.mockReset() })

describe('POST /api/house/verify', () => {
  it('returns an invited house (hidden from anon) for a valid edit code', async () => {
    wire({ house: { qr_code_id: 'TEST1', status: 'invited', artist_name: 'Mara' }, images: [{ id: 1 }] })
    const res = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'CODE' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.house.status).toBe('invited')
    expect(json.images).toHaveLength(1)
  })

  it('rejects a wrong edit code with 403, returns no house, and counts the failure', async () => {
    const codes = wire({ house: { qr_code_id: 'TEST1', status: 'invited' } })
    const res = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'WRNG' }))
    expect(res.status).toBe(403)
    expect((await res.json()).house).toBeUndefined()
    expect(codes.TEST1.failed_attempts).toBe(1)
  })

  it('treats a retired code as unknown even with the right edit code', async () => {
    wire({ codes: { TEST1: { edit_code: 'CODE', failed_attempts: 0, locked_until: null, retired_at: '2026-01-01T00:00:00Z' } }, house: null })
    const res = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'CODE' }))
    expect(res.status).toBe(404)
  })

  it('returns 404 for an unknown qr code', async () => {
    wire({ house: null })
    const res = await POST(makeRequest({ qr_code_id: 'NOPE1', edit_code: 'CODE' }))
    expect(res.status).toBe(404)
  })

  it('locks the code after repeated wrong guesses, even from different IPs, and the lock blocks the correct code', async () => {
    const codes = wire({ house: { qr_code_id: 'TEST1', status: 'live' } })
    for (let i = 1; i < EDIT_CODE_MAX_FAILURES; i++) {
      const r = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'WRG' + (i % 9) }, `10.0.0.${i}`))
      expect(r.status).toBe(403)
    }
    const last = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'WRG9' }, '10.0.1.1'))
    expect(last.status).toBe(429)
    expect(last.headers.get('Retry-After')).toBeTruthy()
    expect(codes.TEST1.locked_until).toBeTruthy()

    const correct = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'CODE' }, '10.0.2.1'))
    expect(correct.status).toBe(429)
  })

  it('an expired lock lets the correct code through and resets the counter', async () => {
    const codes = wire({
      codes: { TEST1: { edit_code: 'CODE', failed_attempts: EDIT_CODE_MAX_FAILURES, locked_until: new Date(Date.now() - 1000).toISOString() } },
      house: { qr_code_id: 'TEST1', status: 'live' },
    })
    const res = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'CODE' }))
    expect(res.status).toBe(200)
    expect(codes.TEST1.failed_attempts).toBe(0)
    expect(codes.TEST1.locked_until).toBeNull()
  })

  it('throttles one IP scanning many codes via the per-minute tier', async () => {
    const codes: Record<string, CodeRow> = {}
    for (let i = 0; i < 20; i++) codes[`ID${String(i).padStart(3, '0')}`] = { edit_code: 'CODE', failed_attempts: 0, locked_until: null }
    wire({ codes, house: { qr_code_id: 'TEST1', status: 'live' } })
    // editVerifyFailPerMinute.max is 15 recorded failures; once the bucket is
    // over the cap every further attempt from that IP is blocked, although no
    // single code has reached its own lock.
    const statuses: number[] = []
    for (let i = 0; i < 20; i++) {
      const r = await POST(makeRequest({ qr_code_id: `ID${String(i).padStart(3, '0')}`, edit_code: 'WRNG' }, '7.7.7.7'))
      statuses.push(r.status)
    }
    expect(statuses.slice(0, 16).every(s => s === 403)).toBe(true)
    expect(statuses.slice(16).every(s => s === 429)).toBe(true)
  })

  it('tolerates a realistic shared-IP volume of wrong-code typos without throttling', async () => {
    wire({ house: { qr_code_id: 'TEST1', status: 'live' }, images: [] })
    for (let i = 0; i < 8; i++) {
      const r = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'WRG' + (i % 9) }))
      expect(r.status).toBe(403)
    }
  })

  it('returns house:null for a valid but unclaimed QR (page shows claim form)', async () => {
    wire({ house: null })
    const res = await POST(makeRequest({ qr_code_id: 'TEST1', edit_code: 'CODE' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.house).toBeNull()
  })
})
