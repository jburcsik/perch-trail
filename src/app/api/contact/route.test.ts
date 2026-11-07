/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { __resetRateLimitForTests, checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'

const inserts: Array<Record<string, unknown>> = []
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: null } } }),
  }),
}))
jest.mock('@/lib/admin-notify', () => ({ notifyAdmin: jest.fn() }))

import { POST } from './route'

function makeRequest(body: unknown, ip = '2.2.2.2') {
  return new NextRequest('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

beforeEach(() => { __resetRateLimitForTests(); inserts.length = 0; delete process.env.TURNSTILE_SECRET_KEY })

describe('POST /api/contact', () => {
  it('stores a cleaned inquiry and does not echo the row', async () => {
    const res = await POST(makeRequest({ name: '  Ivo\nMarsh ', email: 'IVO@perchtrail.example', message: 'Hello', role: 'host' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: 'Inquiry submitted successfully' })
    expect(inserts).toEqual([{ name: 'Ivo Marsh', email: 'ivo@perchtrail.example', message: 'Hello', category: 'host' }])
  })

  it('drops an unknown role to a null category and caps long fields', async () => {
    await POST(makeRequest({ name: 'x'.repeat(300), email: 'a@perchtrail.example', message: 'm'.repeat(5000), role: 'admin' }))
    expect((inserts[0].name as string).length).toBe(120)
    expect((inserts[0].message as string).length).toBe(4000)
    expect(inserts[0].category).toBeNull()
  })

  it('rejects non-string and malformed input without touching the database', async () => {
    expect((await POST(makeRequest({ name: { x: 1 }, email: 'a@perchtrail.example' }))).status).toBe(400)
    expect((await POST(makeRequest({ name: 'Ivo', email: 'not-an-email' }))).status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('answers the honeypot with 200 and stores nothing', async () => {
    const res = await POST(makeRequest({ name: 'Bot', email: 'bot@perchtrail.example', website: 'http://spam.example' }))
    expect(res.status).toBe(200)
    expect(inserts).toHaveLength(0)
  })

  it('requires a Turnstile token when the secret is configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'configured'
    const res = await POST(makeRequest({ name: 'Ivo', email: 'ivo@perchtrail.example' }))
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('is rate limited per IP', async () => {
    for (let i = 0; i < RateLimitPresets.requestForm.max; i++) checkRateLimit('9.9.9.9', 'requestForm', RateLimitPresets.requestForm)
    const res = await POST(makeRequest({ name: 'Ivo', email: 'ivo@perchtrail.example' }, '9.9.9.9'))
    expect(res.status).toBe(429)
  })
})
