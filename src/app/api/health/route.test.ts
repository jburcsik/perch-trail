/**
 * @jest-environment node
 *
 * /api/health is OK only when the server Supabase client has service-role
 * privileges (auth.admin works) and the server image codec loads. Admin only.
 */
const listUsersMock = jest.fn()
const hasKeyMock = jest.fn()
const probeMock = jest.fn()
jest.mock('@/lib/supabase-admin', () => ({
  hasServiceRoleKey: () => hasKeyMock(),
  serviceClient: () => ({ auth: { admin: { listUsers: (...a: unknown[]) => listUsersMock(...a) } } }),
}))
jest.mock('@/lib/image-codec-probe', () => ({ probeImageCodec: () => probeMock() }))
const getAdminUserMock = jest.fn()
jest.mock('@/lib/admin-auth', () => ({ getAdminUser: () => getAdminUserMock() }))

import { GET } from './route'

beforeEach(() => {
  listUsersMock.mockReset()
  hasKeyMock.mockReset()
  probeMock.mockReset()
  hasKeyMock.mockReturnValue(true)
  probeMock.mockResolvedValue({ ok: true })
  getAdminUserMock.mockReset()
  getAdminUserMock.mockResolvedValue({ id: 'admin-1' })
})

describe('GET /api/health', () => {
  it('401 without an admin session, before touching Supabase', async () => {
    getAdminUserMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(listUsersMock).not.toHaveBeenCalled()
  })

  it('503 when no service-role key is configured', async () => {
    hasKeyMock.mockReturnValue(false)
    const res = await GET()
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('no_service_role_key')
  })

  it('503 when the key lacks service-role privileges (auth.admin errors)', async () => {
    listUsersMock.mockResolvedValue({ data: null, error: { message: 'not allowed' } })
    const res = await GET()
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('not_service_role')
  })

  it('503 when the server image codec will not load', async () => {
    listUsersMock.mockResolvedValue({ data: { users: [] }, error: null })
    probeMock.mockResolvedValue({ ok: false, detail: 'ERR_DLOPEN_FAILED: libvips-cpp.so' })
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('image_codec_unavailable')
    expect(body.detail).toContain('ERR_DLOPEN_FAILED')
  })

  it('does not probe the image codec when the Supabase key is already wrong', async () => {
    listUsersMock.mockResolvedValue({ data: null, error: { message: 'not allowed' } })
    await GET()
    expect(probeMock).not.toHaveBeenCalled()
  })

  it('200 ok when the service-role client works and the codec loads', async () => {
    listUsersMock.mockResolvedValue({ data: { users: [] }, error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, serviceRole: true, imageCodec: true })
  })
})
