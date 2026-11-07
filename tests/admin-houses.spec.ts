import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Admin /api/admin/houses/[id] guards', () => {
  test('POST /suspend without a session returns 401', async ({ request }) => {
    const res = await request.post('/api/admin/houses/AAAA/suspend', {
      data: { reason: 'test' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /unsuspend without a session returns 401', async ({ request }) => {
    const res = await request.post('/api/admin/houses/AAAA/unsuspend')
    expect(res.status()).toBe(401)
  })

  test('DELETE /api/admin/houses/[id] without a session returns 401', async ({ request }) => {
    const res = await request.delete('/api/admin/houses/AAAA', {
      headers: { 'X-Confirm-Slug': 'AAAA' },
    })
    expect(res.status()).toBe(401)
  })
})
