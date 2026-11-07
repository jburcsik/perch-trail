/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const inquiriesResultMock = jest.fn()
const requestsResultMock = jest.fn()
const unreviewedHousesResultMock = jest.fn()

jest.mock('@/lib/supabase-admin', () => ({
  serviceClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        not: () => chain,
        then: (resolve: (v: unknown) => unknown) =>
          resolve(
            table === 'inquiries' ? inquiriesResultMock()
              : table === 'houses' ? unreviewedHousesResultMock()
              : requestsResultMock()
          ),
      }
      return chain
    },
  }),
}))

const sendEmailMock = jest.fn(async (_msg: unknown) => ({ id: 'email-1' }))
jest.mock('@/lib/email', () => ({ sendEmail: (msg: unknown) => sendEmailMock(msg) }))

let mockEnv: Record<string, string> = {}
jest.mock('@/lib/env', () => ({
  getServerEnv: (key: string) => mockEnv[key] ?? '',
  siteUrl: () => 'https://perchtrail.example',
}))

import { GET } from './route'

function makeRequest(bearer?: string) {
  return new NextRequest('http://localhost/api/cron/new-inquiries-digest', {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
  })
}

describe('GET /api/cron/new-inquiries-digest', () => {
  beforeEach(() => {
    sendEmailMock.mockClear()
    inquiriesResultMock.mockReset().mockReturnValue({ data: [], error: null })
    requestsResultMock.mockReset().mockReturnValue({ data: [], error: null })
    unreviewedHousesResultMock.mockReset().mockReturnValue({ data: [], error: null })
    mockEnv = { CRON_SECRET: 'cron-secret-placeholder-value', ADMIN_NOTIFY_EMAIL: 'admin@example.com' }
  })

  it('401s with no Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('401s with the wrong bearer token', async () => {
    const res = await GET(makeRequest('wrong'))
    expect(res.status).toBe(401)
  })

  it('401s when CRON_SECRET is unset, even if a bearer is supplied', async () => {
    mockEnv.CRON_SECRET = ''
    const res = await GET(makeRequest('anything'))
    expect(res.status).toBe(401)
  })

  it('returns 500 and never sends when a query errors, instead of silently treating it as empty', async () => {
    inquiriesResultMock.mockReturnValue({ data: null, error: { message: 'boom' } })
    const res = await GET(makeRequest('cron-secret-placeholder-value'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.reason).toBe('query_error')
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('returns sent:false/no_new_items and does not email when both lists are empty', async () => {
    const res = await GET(makeRequest('cron-secret-placeholder-value'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ sent: false, reason: 'no_new_items' })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('returns sent:false/no_admin_email_configured when there are new items but no notify address', async () => {
    mockEnv.ADMIN_NOTIFY_EMAIL = ''
    inquiriesResultMock.mockReturnValue({ data: [{ id: 1, name: 'Otis Fenwick', category: null, created_at: '2026-07-08T10:00:00Z' }], error: null })
    const res = await GET(makeRequest('cron-secret-placeholder-value'))
    const body = await res.json()
    expect(body).toEqual({ sent: false, reason: 'no_admin_email_configured' })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('sends the digest and reports counts when there are new items and a notify address', async () => {
    inquiriesResultMock.mockReturnValue({ data: [{ id: 1, name: 'Otis Fenwick', category: null, created_at: '2026-07-08T10:00:00Z' }], error: null })
    requestsResultMock.mockReturnValue({ data: [{ id: 'r1', requester_name: 'Rosa Vance', created_at: '2026-07-08T10:00:00Z', type: 'new_profile' }], error: null })
    const res = await GET(makeRequest('cron-secret-placeholder-value'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ sent: true, inquiryCount: 1, requestCount: 1, unreviewedHouseCount: 0 })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({ to: 'admin@example.com' })
  })

  // Houses published live without admin review.
  it('sends the digest and reports the count when only unreviewed-publish houses exist', async () => {
    unreviewedHousesResultMock.mockReturnValue({
      data: [{ qr_code_id: 'A1', slug: 'a-house', artist_name: 'Auto Approved', unreviewed_publish_source: 'auto_approve_edit' }],
      error: null,
    })
    const res = await GET(makeRequest('cron-secret-placeholder-value'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ sent: true, inquiryCount: 0, requestCount: 0, unreviewedHouseCount: 1 })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const emailArgs = sendEmailMock.mock.calls[0][0] as { html: string }
    expect(emailArgs.html).toContain('Auto Approved')
  })

  it('returns 500 and never sends when the unreviewed-houses query errors', async () => {
    unreviewedHousesResultMock.mockReturnValue({ data: null, error: { message: 'boom' } })
    const res = await GET(makeRequest('cron-secret-placeholder-value'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.reason).toBe('query_error')
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
