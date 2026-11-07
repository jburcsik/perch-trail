/**
 * @jest-environment node
 *
 * Coverage for the admin requests action endpoint: deny writes `denied` plus
 * the note, dismiss writes `dismissed`, and the guards (auth, already
 * reviewed, note required) hold.
 */
import { NextRequest } from 'next/server'

// --- mocks (registered before importing the route) ---
const fromMock = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}))

const getAdminUserMock = jest.fn()
jest.mock('@/lib/admin-auth', () => ({
  getAdminUser: () => getAdminUserMock(),
}))

const approveNewProfileMock = jest.fn()
const approveEditRequestMock = jest.fn()
const denyEditRequestMock = jest.fn()
jest.mock('@/lib/approval', () => ({
  approveNewProfile: (...a: unknown[]) => approveNewProfileMock(...a),
  approveEditRequest: (...a: unknown[]) => approveEditRequestMock(...a),
  denyEditRequest: (...a: unknown[]) => denyEditRequestMock(...a),
}))

import { POST } from './route'

const ctx = (id = 'req-1') => ({ params: Promise.resolve({ id }) })

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/requests/req-1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Wire the supabase mock: a pending request of `type`, capturing the update. */
function seedPendingRequest(type: 'new_profile' | 'edit', captured: { update?: Record<string, unknown> }) {
  fromMock.mockImplementation((table: string) => {
    if (table !== 'profile_requests') throw new Error(`unexpected table ${table}`)
    return {
      select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'req-1', status: 'pending', type }, error: null }) }) }),
      update: (vals: Record<string, unknown>) => {
        captured.update = vals
        return { eq: async () => ({ error: null }) }
      },
    }
  })
}

beforeEach(() => {
  fromMock.mockReset()
  getAdminUserMock.mockReset()
  getAdminUserMock.mockResolvedValue({ id: 'admin-1' })
})

describe('POST /api/admin/requests/[id]', () => {
  it('deny writes status=denied with the rejection note', async () => {
    const captured: { update?: Record<string, unknown> } = {}
    seedPendingRequest('new_profile', captured)

    const res = await POST(makeRequest({ action: 'deny', rejectionNote: 'Not enough detail.' }), ctx())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, status: 'denied' })
    expect(captured.update).toMatchObject({ status: 'denied', rejection_note: 'Not enough detail.', reviewed_by: 'admin-1' })
    expect(captured.update?.reviewed_at).toBeTruthy()
  })

  it('dismiss writes status=dismissed and no rejection note', async () => {
    const captured: { update?: Record<string, unknown> } = {}
    seedPendingRequest('new_profile', captured)

    const res = await POST(makeRequest({ action: 'dismiss' }), ctx())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, status: 'dismissed' })
    expect(captured.update).toMatchObject({ status: 'dismissed', reviewed_by: 'admin-1' })
    expect(captured.update).not.toHaveProperty('rejection_note')
  })

  it('deny without a note is rejected (400) and writes nothing', async () => {
    const captured: { update?: Record<string, unknown> } = {}
    seedPendingRequest('new_profile', captured)

    const res = await POST(makeRequest({ action: 'deny', rejectionNote: '   ' }), ctx())

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'rejection_note_required' })
    expect(captured.update).toBeUndefined()
  })

  it('returns 409 when the request is already reviewed', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'req-1', status: 'denied', type: 'new_profile' }, error: null }) }) }),
    }))

    const res = await POST(makeRequest({ action: 'dismiss' }), ctx())
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'already_reviewed' })
  })

  it('returns 401 when there is no admin session', async () => {
    getAdminUserMock.mockResolvedValue(null)
    const res = await POST(makeRequest({ action: 'dismiss' }), ctx())
    expect(res.status).toBe(401)
  })

  it('approve (new_profile) delegates to approveNewProfile and reports emailSent', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'req-1', status: 'pending', type: 'new_profile' }, error: null }) }) }),
    }))
    approveNewProfileMock.mockResolvedValue({ ok: true, qrCodeId: 'QR1', editCode: 'CODE', emailId: 'email-1' })

    const res = await POST(makeRequest({ action: 'approve' }), ctx())

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, qrCodeId: 'QR1', editCode: 'CODE', emailSent: true })
    expect(approveNewProfileMock).toHaveBeenCalledWith('req-1', 'admin-1')
  })
})
