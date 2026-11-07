/**
 * @jest-environment node
 *
 * Coverage for the house hard-delete endpoint. This is the permanent,
 * typed-confirmation path: it DELETEs the house and retires the QR code. The
 * one-click soft delete (archive) is handled client-side, not here.
 */
import { NextRequest } from 'next/server'

const fromMock = jest.fn()
const removeMock = jest.fn(async (_paths: string[]) => ({ error: null }))
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock, storage: { from: () => ({ remove: (paths: string[]) => removeMock(paths) }) } }),
}))

const getAdminUserMock = jest.fn()
jest.mock('@/lib/admin-auth', () => ({ getAdminUser: () => getAdminUserMock() }))

import { DELETE } from './route'

const ctx = (id = 'AB12') => ({ params: Promise.resolve({ id }) })
function makeReq(confirm?: string) {
  return new NextRequest('http://localhost/api/admin/houses/AB12', {
    method: 'DELETE',
    headers: confirm ? { 'X-Confirm-Slug': confirm } : {},
  })
}
/** Wire the supabase mock; records the delete, QR retire, and marker release. */
function seedHouse(
  calls: { deleted?: boolean; retired?: boolean; retirePatch?: Record<string, unknown>; markerPatch?: Record<string, unknown> },
  house: unknown = { qr_code_id: 'AB12', slug: 'my-house' },
  opts: { retireError?: { message: string } } = {}
) {
  fromMock.mockImplementation((table: string) => {
    if (table === 'houses') {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: house }) }) }),
        delete: () => ({ eq: async () => { calls.deleted = true; return { error: null } } }),
      }
    }
    if (table === 'house_images') {
      return { select: () => ({ eq: async () => ({ data: [{ storage_path: 'AB12/a.webp' }, { storage_path: 'AB12/b.webp' }] }) }) }
    }
    if (table === 'qr_codes') {
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: async () => {
            calls.retired = !opts.retireError
            calls.retirePatch = patch
            return { error: opts.retireError ?? null }
          },
        }),
      }
    }
    if (table === 'map_markers') {
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: async () => { calls.markerPatch = patch; return { error: null } },
        }),
      }
    }
    throw new Error(`unexpected table ${table}`)
  })
}

beforeEach(() => {
  fromMock.mockReset()
  removeMock.mockClear()
  getAdminUserMock.mockReset()
  getAdminUserMock.mockResolvedValue({ id: 'admin-1' })
})

describe('DELETE /api/admin/houses/[id] (hard delete)', () => {
  it('deletes the house, retires the QR code, and releases any linked marker', async () => {
    const calls: { deleted?: boolean; retired?: boolean; retirePatch?: Record<string, unknown>; markerPatch?: Record<string, unknown> } = {}
    seedHouse(calls)

    const res = await DELETE(makeReq('my-house'), ctx())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, qrRetired: true, markerReleased: true })
    expect(calls.deleted).toBe(true)
    // The photo files are removed from storage; the rows cascade with the house.
    expect(removeMock).toHaveBeenCalledWith(['AB12/a.webp', 'AB12/b.webp'])
    expect(calls.retired).toBe(true)
    // 'profile_deleted' must be a constraint-legal retired_reason.
    expect(calls.retirePatch).toMatchObject({ retired_reason: 'profile_deleted' })
    // A promoted street dot pointing at this code goes back to active,
    // releasing its UNIQUE claim so the code can't poison future promotions.
    expect(calls.markerPatch).toMatchObject({ status: 'active', promoted_qr_code_id: null })
  })

  it('reports qrRetired:false instead of a silent 200 when the retire fails', async () => {
    const calls: { deleted?: boolean } = {}
    seedHouse(calls, { qr_code_id: 'AB12', slug: 'my-house' }, { retireError: { message: 'check constraint' } })

    const res = await DELETE(makeReq('my-house'), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.qrRetired).toBe(false)
    expect(calls.deleted).toBe(true)
  })

  it('accepts the qr_code_id as the confirmation token too', async () => {
    const calls: { deleted?: boolean } = {}
    seedHouse(calls)
    const res = await DELETE(makeReq('AB12'), ctx())
    expect(res.status).toBe(200)
    expect(calls.deleted).toBe(true)
  })

  it('401 without an admin session', async () => {
    getAdminUserMock.mockResolvedValue(null)
    const res = await DELETE(makeReq('my-house'), ctx())
    expect(res.status).toBe(401)
  })

  it('400 when the confirmation header is missing', async () => {
    const res = await DELETE(makeReq(), ctx())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('confirmation_required')
  })

  it('404 when the house does not exist', async () => {
    const calls: { deleted?: boolean } = {}
    seedHouse(calls, null)
    const res = await DELETE(makeReq('my-house'), ctx())
    expect(res.status).toBe(404)
    expect(calls.deleted).toBeUndefined()
  })

  it('400 when the confirmation token does not match (no delete)', async () => {
    const calls: { deleted?: boolean } = {}
    seedHouse(calls)
    const res = await DELETE(makeReq('wrong-slug'), ctx())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('confirmation_mismatch')
    expect(calls.deleted).toBeUndefined()
  })
})
