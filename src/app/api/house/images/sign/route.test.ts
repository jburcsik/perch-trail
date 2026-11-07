/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { __resetRateLimitForTests, checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'

// Mock supabase before importing the route; the route resolves the client lazily.
const fromMock = jest.fn()
const createSignedUploadUrlMock = jest.fn()
const getPublicUrlMock = jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/TEST1/x.webp' } }))
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    rpc: async () => ({ data: 1, error: null }),
    storage: { from: () => ({ createSignedUploadUrl: createSignedUploadUrlMock, getPublicUrl: getPublicUrlMock }) },
  }),
}))

import { POST } from './route'

function makeRequest(body: unknown, ip = '7.7.7.7') {
  return new NextRequest('http://localhost/api/house/images/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

// Client call sites compress to WebP before signing, so every caller sends ext: 'webp'.
const validBody = { qr_code_id: 'TEST1', edit_code: 'CODE', ext: 'webp' }

// qr_codes lookup returns a matching edit code by default.
function mockEditCode(code = 'CODE') {
  fromMock.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: { edit_code: code } }) }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
  }))
}

beforeEach(() => {
  __resetRateLimitForTests()
  fromMock.mockReset()
  createSignedUploadUrlMock.mockReset()
  createSignedUploadUrlMock.mockResolvedValue({
    data: { token: 'signed-token-abc', path: 'TEST1/x.webp' },
    error: null,
  })
})

describe('POST /api/house/images/sign', () => {
  it('mints a signed upload URL for a valid edit code', async () => {
    mockEditCode('CODE')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.token).toBe('signed-token-abc')
    expect(json.storage_path).toMatch(/^TEST1\//)
    expect(json.image_url).toContain('https://')
    // The path is server-generated, never echoed from client input.
    expect(createSignedUploadUrlMock).toHaveBeenCalledTimes(1)
    expect(createSignedUploadUrlMock.mock.calls[0][0]).toMatch(/^TEST1\/\d+-[0-9a-f-]+\.webp$/)
  })

  it('rejects a wrong edit code with 403 and never mints a URL', async () => {
    mockEditCode('CODE')
    const res = await POST(makeRequest({ ...validBody, edit_code: 'WRONG' }))
    expect(res.status).toBe(403)
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled()
  })

  it('rejects a disallowed file extension with 400', async () => {
    mockEditCode('CODE')
    const res = await POST(makeRequest({ ...validBody, ext: 'exe' }))
    expect(res.status).toBe(400)
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled()
  })

  // Accepting png here would let a caller skip the client's WebP compression
  // and store a full-size original.
  it('rejects a non-WebP extension (png) with 400', async () => {
    mockEditCode('CODE')
    const res = await POST(makeRequest({ ...validBody, ext: 'png' }))
    expect(res.status).toBe(400)
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled()
  })

  it('rejects missing fields with 400', async () => {
    mockEditCode('CODE')
    const res = await POST(makeRequest({ qr_code_id: 'TEST1' }))
    expect(res.status).toBe(400)
  })

  it('returns 429 once the stewardEdit rate-limit bucket is exhausted', async () => {
    const ip = '9.9.9.9'
    for (let i = 0; i < RateLimitPresets.stewardEdit.max; i++) {
      checkRateLimit(ip, 'stewardEdit', RateLimitPresets.stewardEdit)
    }
    const res = await POST(makeRequest(validBody, ip))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })
})
