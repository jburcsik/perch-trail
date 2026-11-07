/**
 * @jest-environment node
 *
 * Claim path coverage: a claim creates a page that can go straight to
 * 'live', so the birdhouse name is required up front, the minimum viable
 * birdhouse. Status still follows the moderation_enabled setting.
 */
import { NextRequest } from 'next/server'
import { __resetRateLimitForTests, checkRateLimit } from '@/lib/rate-limit'

const fromMock = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock, rpc: async () => ({ data: 1, error: null }) }),
}))

import { POST } from './route'

function makeRequest(body: unknown, ip = '6.6.6.6') {
  return new NextRequest('http://localhost/api/house/claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

const validBody = {
  qr_code_id: 'TEST1',
  edit_code: 'CODE',
  slug: 'Orchard Lantern',
  artist_name: 'Mara Linden',
}

function wireSupabase(opts: {
  moderation: 'true' | 'false'
  inserts: Array<Record<string, unknown>>
}) {
  const { moderation, inserts } = opts
  fromMock.mockImplementation((table: string) => {
    if (table === 'qr_codes') {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { edit_code: 'CODE' }, error: null }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }
    }
    if (table === 'houses') {
      return {
        // No existing row: the code is unclaimed.
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        insert: async (row: Record<string, unknown>) => {
          inserts.push(row)
          return { error: null }
        },
      }
    }
    if (table === 'settings') {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { value: moderation }, error: null }) }) }),
      }
    }
    throw new Error(`unexpected table ${table}`)
  })
}

beforeEach(() => {
  __resetRateLimitForTests()
  fromMock.mockReset()
})

describe('POST /api/house/claim: name required', () => {
  it('rejects a nameless claim with 400 and inserts nothing', async () => {
    const inserts: Array<Record<string, unknown>> = []
    wireSupabase({ moderation: 'false', inserts })

    const namelessBody = { ...validBody, slug: undefined }
    const res = await POST(makeRequest(namelessBody))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ needsName: true })
    expect(inserts).toHaveLength(0)
  })

  it('rejects a name that slugifies to nothing (reserved/punctuation)', async () => {
    const inserts: Array<Record<string, unknown>> = []
    wireSupabase({ moderation: 'false', inserts })

    const res = await POST(makeRequest({ ...validBody, slug: '!!!' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ needsName: true })
    expect(inserts).toHaveLength(0)
  })

  it('claims live with a slugified name when moderation is off', async () => {
    const inserts: Array<Record<string, unknown>> = []
    wireSupabase({ moderation: 'false', inserts })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, status: 'live' })
    expect(inserts).toHaveLength(1)
    expect(inserts[0].slug).toBe('orchard-lantern')
    expect(inserts[0].status).toBe('live')
    expect(inserts[0].auto_approve_edits).toBe(true)
  })

  it('claims into review when moderation is on', async () => {
    const inserts: Array<Record<string, unknown>> = []
    wireSupabase({ moderation: 'true', inserts })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, status: 'review' })
    expect(inserts[0].status).toBe('review')
    // Later edits queue for review too, instead of publishing on the first save.
    expect(inserts[0].auto_approve_edits).toBe(false)
  })

  // A no-moderation claim publishes with zero admin involvement; flag
  // it so the admin notification system can surface it.
  it('flags a no-moderation claim as unreviewed', async () => {
    const inserts: Array<Record<string, unknown>> = []
    wireSupabase({ moderation: 'false', inserts })

    await POST(makeRequest(validBody))
    expect(inserts[0].unreviewed_publish_source).toBe('no_moderation_claim')
    expect(typeof inserts[0].unreviewed_publish_at).toBe('string')
  })

  it('does not flag a moderated claim (goes to review, not live)', async () => {
    const inserts: Array<Record<string, unknown>> = []
    wireSupabase({ moderation: 'true', inserts })

    await POST(makeRequest(validBody))
    expect('unreviewed_publish_at' in inserts[0]).toBe(false)
  })

  // Claim is authenticated by the edit code, so it shares the stewardEdit
  // budget rather than the tight anonymous bucket a shared IP could exhaust.
  it('shares the generous stewardEdit budget, not the tight default bucket', async () => {
    const inserts: Array<Record<string, unknown>> = []
    wireSupabase({ moderation: 'false', inserts })
    const ip = '7.7.7.7'

    // Burn the tight 'default' bucket (10/15min) completely with unrelated traffic.
    for (let i = 0; i < 10; i++) checkRateLimit(ip)
    expect(checkRateLimit(ip).allowed).toBe(false)

    // A claim from that same IP must still succeed; it's on a separate budget.
    const res = await POST(makeRequest(validBody, ip))
    expect(res.status).toBe(200)
  })
})
