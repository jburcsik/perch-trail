import { test, expect } from '@playwright/test'

test.describe('GET /api/cron/new-inquiries-digest auth', () => {
  test('missing Authorization header returns 401', async ({ request }) => {
    const res = await request.get('/api/cron/new-inquiries-digest')
    expect(res.status()).toBe(401)
  })

  test('wrong bearer value returns 401', async ({ request }) => {
    const res = await request.get('/api/cron/new-inquiries-digest', {
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    expect(res.status()).toBe(401)
  })
})
