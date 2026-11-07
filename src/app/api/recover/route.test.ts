/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { __resetRateLimitForTests } from '@/lib/rate-limit'

const fromMock = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}))
const sendEmailMock = jest.fn(async (_msg: unknown) => ({ ok: true }))
jest.mock('@/lib/email', () => ({ sendEmail: (msg: unknown) => sendEmailMock(msg) }))

import { POST } from './route'

function makeRequest(body: unknown, ip = '5.5.5.5') {
  return new NextRequest('http://localhost/api/recover', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

function wire(match: boolean) {
  const updates: Array<Record<string, unknown>> = []
  fromMock.mockImplementation((table: string) => {
    if (table === 'profile_requests') {
      const chain = { eq: () => chain, maybeSingle: async () => ({ data: match ? { id: 'r1', requester_email: 'mara@perchtrail.example' } : null }) }
      return { select: () => chain }
    }
    if (table === 'qr_codes') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        update: (patch: Record<string, unknown>) => { updates.push(patch); return { eq: async () => ({ error: null }) } },
      }
    }
    throw new Error(`unexpected table ${table}`)
  })
  return updates
}

beforeEach(() => { __resetRateLimitForTests(); fromMock.mockReset(); sendEmailMock.mockClear(); delete process.env.TURNSTILE_SECRET_KEY })

describe('POST /api/recover', () => {
  it('gives the same neutral answer, readable every time, when nothing matches', async () => {
    wire(false)
    for (let i = 0; i < 3; i++) {
      const res = await POST(makeRequest({ profileUrl: 'https://perchtrail.example/h/TEST3', email: 'nobody@perchtrail.example' }))
      expect(res.status).toBe(200)
      expect((await res.json()).ok).toBe(true)
    }
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('rotates the code, clears any lockout and emails the matched requester', async () => {
    const updates = wire(true)
    const res = await POST(makeRequest({ profileUrl: 'https://perchtrail.example/h/TEST3', email: 'mara@perchtrail.example' }))
    expect(res.status).toBe(200)
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ failed_attempts: 0, locked_until: null })
    expect(String(updates[0].edit_code)).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it('rate limits recovery attempts per IP', async () => {
    wire(false)
    const statuses: number[] = []
    for (let i = 0; i < 4; i++) {
      statuses.push((await POST(makeRequest({ profileUrl: 'x', email: 'a@perchtrail.example' }, '6.6.6.6'))).status)
    }
    expect(statuses).toEqual([200, 200, 200, 429])
  })
})
