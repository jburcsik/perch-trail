/**
 * @jest-environment node
 *
 * Coverage for the steward edit path, the main functional workflow
 * after the public page. Status lifecycle (migration 021):
 *   invited, then (steward first save) live (auto-approve) or review (moderated)
 *   live, then (edit) live in place (auto-approve) or a queued edit request
 *   suspended: steward is locked out (admin moderation).
 */
import { NextRequest } from 'next/server'
import { __resetRateLimitForTests } from '@/lib/rate-limit'

// Mock supabase before importing the route; the route resolves the client
// lazily, so a single mock `from` covers every serviceClient() call.
const fromMock = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock, rpc: async () => ({ data: 1, error: null }) }),
}))

import { POST } from './route'

function makeRequest(body: unknown, ip = '5.5.5.5') {
  return new NextRequest('http://localhost/api/house/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

const validBody = {
  qr_code_id: 'TEST1',
  edit_code: 'CODE',
  slug: 'orchard-lantern',
  artist_name: 'Mara Linden',
  bio: 'A little house on Orchard Row.',
}

/**
 * Build a `from()` implementation around a house fixture, capturing every
 * houses.update() patch so assertions can inspect what was written.
 */
function wireSupabase(opts: {
  house: Record<string, unknown>
  setting?: { value: string } | null
  capturedUpdates: Array<Record<string, unknown>>
  inserts?: Array<Record<string, unknown>>
}) {
  const { house, setting = null, capturedUpdates, inserts = [] } = opts
  fromMock.mockImplementation((table: string) => {
    if (table === 'qr_codes') {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { edit_code: 'CODE' }, error: null }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }
    }
    if (table === 'settings') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: setting }) }) }),
      }
    }
    if (table === 'houses') {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: house, error: null }) }) }),
        update: (patch: Record<string, unknown>) => {
          capturedUpdates.push(patch)
          return { eq: async () => ({ error: null }) }
        },
      }
    }
    if (table === 'profile_requests') {
      return {
        insert: (row: Record<string, unknown>) => {
          inserts.push(row)
          return { select: () => ({ single: async () => ({ data: { id: 'req-1' }, error: null }) }) }
        },
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      }
    }
    throw new Error(`unexpected table ${table}`)
  })
}

beforeEach(() => {
  __resetRateLimitForTests()
  fromMock.mockReset()
})

describe('POST /api/house/update: status lifecycle', () => {
  it('publishes an invited house on first save when auto-approve is on', async () => {
    // The exact state send-welcome creates: status 'invited', auto_approve_edits true.
    const capturedUpdates: Array<Record<string, unknown>> = []
    wireSupabase({
      house: { status: 'invited', auto_approve_edits: true, artist_name: 'Invited Steward', bio: null, artist_bio: null },
      capturedUpdates,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, live: true })

    expect(capturedUpdates).toHaveLength(1)
    expect(capturedUpdates[0].status).toBe('live')
    expect(capturedUpdates[0].artist_name).toBe('Mara Linden')
  })

  // This is one of the two paths that can publish a house with zero
  // admin involvement; flag it so the admin notification system can surface it.
  it('flags an auto-approve first-publish as unreviewed', async () => {
    const capturedUpdates: Array<Record<string, unknown>> = []
    wireSupabase({
      house: { status: 'invited', auto_approve_edits: true, artist_name: 'Invited Steward', bio: null, artist_bio: null },
      capturedUpdates,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)

    expect(capturedUpdates).toHaveLength(1)
    expect(capturedUpdates[0].unreviewed_publish_source).toBe('auto_approve_edit')
    expect(typeof capturedUpdates[0].unreviewed_publish_at).toBe('string')
  })

  it('sends an invited house to review on first save when auto-approve is off', async () => {
    const capturedUpdates: Array<Record<string, unknown>> = []
    const inserts: Array<Record<string, unknown>> = []
    wireSupabase({
      house: { status: 'invited', auto_approve_edits: false, artist_name: 'Draft Steward', bio: null, artist_bio: null },
      capturedUpdates,
      inserts,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, live: false, review: true })

    // Content saved in place + moved to review; NOT queued as a profile_request.
    expect(capturedUpdates).toHaveLength(1)
    expect(capturedUpdates[0].status).toBe('review')
    expect(inserts).toHaveLength(0)
  })

  it('blocks an admin-suspended steward with 403 and writes nothing', async () => {
    const capturedUpdates: Array<Record<string, unknown>> = []
    wireSupabase({
      house: { status: 'suspended', auto_approve_edits: true, artist_name: 'Banned Steward', bio: null, artist_bio: null },
      capturedUpdates,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Profile is suspended')
    expect(capturedUpdates).toHaveLength(0)
  })

  it('edits a live house in place (auto-approve) without changing its status', async () => {
    const capturedUpdates: Array<Record<string, unknown>> = []
    wireSupabase({
      house: { status: 'live', auto_approve_edits: true, artist_name: 'Live Steward', bio: null, artist_bio: null },
      capturedUpdates,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, live: true })
    expect(capturedUpdates).toHaveLength(1)
    expect('status' in capturedUpdates[0]).toBe(false)
    // Already live: an in-place auto-approved edit is not a "went live" event.
    expect('unreviewed_publish_at' in capturedUpdates[0]).toBe(false)
  })

  it('queues an edit request for a live house when auto-approve is off', async () => {
    const capturedUpdates: Array<Record<string, unknown>> = []
    const inserts: Array<Record<string, unknown>> = []
    wireSupabase({
      house: { status: 'live', auto_approve_edits: false, pending_edit_id: null, artist_name: 'Queue Steward', bio: null, artist_bio: null },
      capturedUpdates,
      inserts,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.queued).toBe(true)
    expect(inserts).toHaveLength(1)
    expect(inserts[0].type).toBe('edit')
    // No status change on the live house.
    expect(capturedUpdates.some(u => u.status)).toBe(false)
  })

  it('does not publish an invited house saved without a name', async () => {
    // A location-only first save must not put an empty page on the map, even
    // with auto-approve on. The work still persists.
    const capturedUpdates: Array<Record<string, unknown>> = []
    wireSupabase({
      house: { status: 'invited', auto_approve_edits: true, artist_name: 'Nameless Steward', bio: null, artist_bio: null, slug: null },
      capturedUpdates,
    })

    const namelessBody = { ...validBody, slug: undefined }
    const res = await POST(makeRequest({ ...namelessBody, lat: 40.7812, lng: -73.9665 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, live: false, needsName: true })

    expect(capturedUpdates).toHaveLength(1)
    expect('status' in capturedUpdates[0]).toBe(false)
    expect(capturedUpdates[0].lat).toBe(40.7812)
    expect(capturedUpdates[0].artist_name).toBe('Mara Linden')
  })

  it('keeps a nameless invited house out of review when auto-approve is off', async () => {
    const capturedUpdates: Array<Record<string, unknown>> = []
    const inserts: Array<Record<string, unknown>> = []
    wireSupabase({
      house: { status: 'invited', auto_approve_edits: false, artist_name: 'Draft Steward', bio: null, artist_bio: null, slug: null },
      capturedUpdates,
      inserts,
    })

    const namelessBody = { ...validBody, slug: undefined }
    const res = await POST(makeRequest(namelessBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, live: false, needsName: true })

    expect(capturedUpdates).toHaveLength(1)
    expect('status' in capturedUpdates[0]).toBe(false)
    expect(inserts).toHaveLength(0)
  })

  it('keeps a nameless review house in review', async () => {
    const capturedUpdates: Array<Record<string, unknown>> = []
    wireSupabase({
      house: { status: 'review', auto_approve_edits: true, artist_name: 'Review Steward', bio: 'draft', artist_bio: null, slug: null },
      capturedUpdates,
    })

    const namelessBody = { ...validBody, slug: undefined }
    const res = await POST(makeRequest(namelessBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, live: false, needsName: true })
    expect('status' in capturedUpdates[0]).toBe(false)
  })

  it('never clears a live house name via a blank save', async () => {
    const capturedUpdates: Array<Record<string, unknown>> = []
    wireSupabase({
      house: { status: 'live', auto_approve_edits: true, artist_name: 'Live Steward', bio: null, artist_bio: null, slug: 'kiln-fire' },
      capturedUpdates,
    })

    const namelessBody = { ...validBody, slug: undefined }
    const res = await POST(makeRequest(namelessBody))
    expect(res.status).toBe(200)
    expect(capturedUpdates).toHaveLength(1)
    expect(capturedUpdates[0].slug).toBe('kiln-fire')
  })

  it('rejects a wrong edit code with 403 before any status logic', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'qr_codes') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { edit_code: 'CODE' }, error: null }) }) }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })
    const res = await POST(makeRequest({ ...validBody, edit_code: 'WRNG' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Invalid edit code')
  })
})
