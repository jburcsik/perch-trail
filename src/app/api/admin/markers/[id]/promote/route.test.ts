/**
 * @jest-environment node
 *
 * Promotion of a street dot to a full birdhouse. The critical
 * behaviours: admin-gated; mints an unused QR; creates an INVITED house at
 * the marker's location with NO name derived from the admin label; the
 * marker claim is conditional (double-fire consumes nothing); a failed house
 * insert rolls the claim back.
 */
import { NextRequest } from 'next/server'

const fromMock = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}))

const getAdminUserMock = jest.fn()
jest.mock('@/lib/admin-auth', () => ({
  getAdminUser: () => getAdminUserMock(),
}))

import { POST } from './route'

const MARKER_ID = '11111111-2222-4333-8444-555555555555'

function makeRequest() {
  return new NextRequest(`http://localhost/api/admin/markers/${MARKER_ID}/promote`, { method: 'POST' })
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function wireSupabase(opts: {
  marker: Record<string, unknown> | null
  claimSucceeds?: boolean
  houseInsertError?: { message: string } | null
  freeQr?: { id: string; edit_code: string } | null
  markerUpdates?: Array<Record<string, unknown>>
  houseInserts?: Array<Record<string, unknown>>
}) {
  const {
    marker,
    claimSucceeds = true,
    houseInsertError = null,
    freeQr = { id: 'QR123', edit_code: 'EDIT' },
    markerUpdates = [],
    houseInserts = [],
  } = opts

  fromMock.mockImplementation((table: string) => {
    if (table === 'map_markers') {
      return {
        select: () => ({
          eq: () => ({ single: async () => ({ data: marker, error: marker ? null : { message: 'not found' } }) }),
          // pickUnusedQrCode's held-codes scan
          not: async () => ({ data: [], error: null }),
        }),
        update: (patch: Record<string, unknown>) => {
          markerUpdates.push(patch)
          return {
            eq: (col: string) => {
              // rollback path: single .eq('id', ...) then awaited via .select-less chain
              const chain = {
                eq: () => ({
                  is: () => ({
                    select: async () => ({ data: claimSucceeds ? [{ id: MARKER_ID }] : [], error: null }),
                  }),
                }),
                is: () => ({
                  select: async () => ({ data: claimSucceeds ? [{ id: MARKER_ID }] : [], error: null }),
                }),
                select: async () => ({ data: claimSucceeds ? [{ id: MARKER_ID }] : [], error: null }),
                then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
              }
              void col
              return chain
            },
          }
        },
      }
    }
    if (table === 'qr_codes') {
      return {
        select: () => ({
          is: () => ({
            order: () => ({
              limit: async () => ({ data: freeQr ? [freeQr] : [], error: null }),
            }),
          }),
        }),
      }
    }
    if (table === 'houses') {
      return {
        // pickUnusedQrCode's used-ids scan
        select: async () => ({ data: [], error: null }),
        insert: async (row: Record<string, unknown>) => {
          houseInserts.push(row)
          return { error: houseInsertError }
        },
      }
    }
    throw new Error(`unexpected table ${table}`)
  })
}

beforeEach(() => {
  fromMock.mockReset()
  getAdminUserMock.mockReset()
  getAdminUserMock.mockResolvedValue({ id: 'admin-1' })
})

const ACTIVE_MARKER = {
  id: MARKER_ID,
  label: "blue birdhouse on the maple tree",
  lat: 40.7812,
  lng: -73.9665,
  status: 'active',
  promoted_qr_code_id: null,
}

describe('POST /api/admin/markers/[id]/promote', () => {
  it('rejects unauthenticated callers with 401 and touches nothing', async () => {
    getAdminUserMock.mockResolvedValue(null)
    const houseInserts: Array<Record<string, unknown>> = []
    wireSupabase({ marker: ACTIVE_MARKER, houseInserts })

    const res = await POST(makeRequest(), ctx(MARKER_ID))
    expect(res.status).toBe(401)
    expect(houseInserts).toHaveLength(0)
  })

  it('promotes an active marker: review house at the dot, no name copied', async () => {
    const markerUpdates: Array<Record<string, unknown>> = []
    const houseInserts: Array<Record<string, unknown>> = []
    wireSupabase({ marker: ACTIVE_MARKER, markerUpdates, houseInserts })

    const res = await POST(makeRequest(), ctx(MARKER_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, qrCodeId: 'QR123' })

    expect(markerUpdates[0]).toMatchObject({ status: 'promoted', promoted_qr_code_id: 'QR123' })
    expect(houseInserts).toHaveLength(1)
    // Promoted dots land in Ready for Review, not the steward-only Invited bucket.
    expect(houseInserts[0]).toMatchObject({ qr_code_id: 'QR123', status: 'review', lat: 40.7812, lng: -73.9665 })
    // The admin label must never leak into the public house.
    expect('artist_name' in houseInserts[0]).toBe(false)
    expect('slug' in houseInserts[0]).toBe(false)
  })

  it('returns 409 for an already-promoted marker without consuming anything', async () => {
    const houseInserts: Array<Record<string, unknown>> = []
    wireSupabase({
      marker: { ...ACTIVE_MARKER, status: 'promoted', promoted_qr_code_id: 'QROLD' },
      houseInserts,
    })

    const res = await POST(makeRequest(), ctx(MARKER_ID))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('already_promoted')
    expect(houseInserts).toHaveLength(0)
  })

  it('returns 409 when the conditional claim loses a race (no house created)', async () => {
    const houseInserts: Array<Record<string, unknown>> = []
    wireSupabase({ marker: ACTIVE_MARKER, claimSucceeds: false, houseInserts })

    const res = await POST(makeRequest(), ctx(MARKER_ID))
    expect(res.status).toBe(409)
    expect(houseInserts).toHaveLength(0)
  })

  it('rejects a removed marker with 400', async () => {
    wireSupabase({ marker: { ...ACTIVE_MARKER, status: 'removed' } })
    const res = await POST(makeRequest(), ctx(MARKER_ID))
    expect(res.status).toBe(400)
  })

  it('surfaces qr exhaustion as 500 no_unused_qr_codes', async () => {
    wireSupabase({ marker: ACTIVE_MARKER, freeQr: null })
    const res = await POST(makeRequest(), ctx(MARKER_ID))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('no_unused_qr_codes')
  })

  it('rolls the marker back to active when the house insert fails', async () => {
    const markerUpdates: Array<Record<string, unknown>> = []
    wireSupabase({ marker: ACTIVE_MARKER, houseInsertError: { message: 'boom' }, markerUpdates })

    const res = await POST(makeRequest(), ctx(MARKER_ID))
    expect(res.status).toBe(500)
    // First update claims, second rolls back.
    expect(markerUpdates).toHaveLength(2)
    expect(markerUpdates[1]).toMatchObject({ status: 'active', promoted_qr_code_id: null })
  })

  it('rejects a malformed id with 400', async () => {
    wireSupabase({ marker: null })
    const res = await POST(makeRequest(), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })
})
