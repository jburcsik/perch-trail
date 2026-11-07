/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { __resetRateLimitForTests, checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'

// Mock supabase before importing the route; the route resolves the client lazily,
// so a single mock object covers every db() call inside the handler.
const fromMock = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    rpc: async () => ({ data: 1, error: null }),
    storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/house-images/${path}` } }), remove: async () => ({ error: null }) }) },
  }),
}))

// Importing after the mock is registered.
import { POST } from './route'

function makeRequest(body: unknown, ip = '7.7.7.7') {
  return new NextRequest('http://localhost/api/house/images', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

const validBody = {
  qr_code_id: 'TEST1',
  edit_code: 'CODE',
  storage_path: 'TEST1/img.jpg',
  display_order: 1,
  file_size_kb: 12,
}

beforeEach(() => {
  __resetRateLimitForTests()
  fromMock.mockReset()
})

describe('POST /api/house/images', () => {
  it('returns the inserted row so the client can update local state without refetching', async () => {
    const insertedRow = {
      id: 42,
      qr_code_id: 'TEST1',
      image_url: 'https://example.supabase.co/storage/v1/object/public/house-images/TEST1/img.jpg',
      storage_path: 'TEST1/img.jpg',
      display_order: 1,
    }
    fromMock.mockImplementation((table: string) => {
      if (table === 'qr_codes') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { edit_code: 'CODE' } }) }) }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      if (table === 'house_images') {
        return {
          insert: (row: Record<string, unknown>) => {
            // The URL is derived from the path on the server, never taken from the client.
            expect(row.image_url).toBe(insertedRow.image_url)
            return { select: () => ({ single: async () => ({ data: insertedRow, error: null }) }) }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ ok: true, image: insertedRow })
  })

  it('rejects a storage path that does not belong to the QR code', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { edit_code: 'CODE' } }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }))
    const res = await POST(makeRequest({ ...validBody, storage_path: 'OTHER/img.jpg' }))
    expect(res.status).toBe(400)
  })

  it('uses the stewardEdit scope so an active session does not collide with the default bucket', async () => {
    // Burn the *default* bucket completely on this IP.
    for (let i = 0; i < 10; i++) checkRateLimit('8.8.8.8')
    expect(checkRateLimit('8.8.8.8').allowed).toBe(false)

    fromMock.mockImplementation((table: string) => {
      if (table === 'qr_codes') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { edit_code: 'CODE' } }) }) }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      return {
        insert: () => ({
          select: () => ({ single: async () => ({ data: { id: 1, ...validBody }, error: null }) }),
        }),
      }
    })

    const res = await POST(makeRequest(validBody, '8.8.8.8'))
    // Default bucket is exhausted, but stewardEdit is its own bucket, so the request succeeds.
    expect(res.status).toBe(200)
  })

  it('returns 429 once the stewardEdit bucket itself is exhausted', async () => {
    const ip = '9.9.9.9'
    // Pre-fill the stewardEdit bucket up to its cap.
    for (let i = 0; i < RateLimitPresets.stewardEdit.max; i++) {
      checkRateLimit(ip, 'stewardEdit', RateLimitPresets.stewardEdit)
    }

    const res = await POST(makeRequest(validBody, ip))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })
})
