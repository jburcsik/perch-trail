/**
 * @jest-environment node
 *
 * The deliverable of "send welcome" is the EMAIL. These guard the contract that a
 * failed send is a real failure (502), never a silent success, and that
 * welcome_sent_at is only written once the email is accepted.
 */
import { NextRequest } from 'next/server'

const sendEmailMock = jest.fn()
const serviceClientMock = jest.fn()
const updateCalls: Array<{ table: string; payload: Record<string, unknown> }> = []

jest.mock('@/lib/admin-auth', () => ({ getAdminUser: jest.fn(async () => ({ id: 'admin-1', email: 'admin@x' })) }))
jest.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => sendEmailMock(...a) }))
jest.mock('@/lib/approval', () => ({
  pickUnusedQrCode: jest.fn(async () => ({ code: { id: 'ZZ1', edit_code: 'EC1' } })),
  welcomeEmailHtml: () => '<p>hi</p>',
  welcomeEmailText: () => 'hi',
}))
jest.mock('@/lib/env', () => ({ siteUrl: () => 'https://perchtrail.example' }))
jest.mock('@/lib/supabase-admin', () => ({ serviceClient: () => serviceClientMock() }))

import { POST } from './route'

function wire(inquiry: Record<string, unknown>) {
  serviceClientMock.mockReturnValue({
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: table === 'inquiries' ? inquiry : { edit_code: 'EC1' }, error: null }),
            maybeSingle: async () => ({ data: table === 'settings' ? { value: 'true' } : null, error: null }),
          }),
        }),
        insert: async () => ({ error: null }),
        update: (payload: Record<string, unknown>) => {
          updateCalls.push({ table, payload })
          return { eq: async () => ({ error: null }) }
        },
      }
    },
  })
}

const req = () => new NextRequest('http://localhost/api/admin/inquiries/1/send-welcome', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
})
const params = Promise.resolve({ id: '1' })

beforeEach(() => {
  sendEmailMock.mockReset()
  serviceClientMock.mockReset()
  updateCalls.length = 0
  ;(jest.requireMock('@/lib/approval') as { pickUnusedQrCode: jest.Mock }).pickUnusedQrCode.mockClear()
})

describe('POST send-welcome: email is the deliverable', () => {
  it('returns 502 and does NOT mark welcome_sent_at when the email fails', async () => {
    wire({ id: 1, name: 'Rosa Vance', email: 'rosa@perchtrail.example', welcome_sent_at: null, assigned_qr_code_id: null })
    sendEmailMock.mockResolvedValue({ error: 'Resend rejected' })

    const res = await POST(req(), { params })
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/email_send_failed/)
    // The house was created + linked, but the welcome must NOT be marked sent.
    expect(updateCalls.some(c => 'welcome_sent_at' in c.payload)).toBe(false)
    expect(updateCalls.some(c => 'assigned_qr_code_id' in c.payload)).toBe(true)
  })

  it('marks welcome_sent_at only after the email is accepted', async () => {
    wire({ id: 1, name: 'Rosa Vance', email: 'rosa@perchtrail.example', welcome_sent_at: null, assigned_qr_code_id: null })
    sendEmailMock.mockResolvedValue({ id: 'email-123' })

    const res = await POST(req(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.emailId).toBe('email-123')
    expect(updateCalls.some(c => 'welcome_sent_at' in c.payload)).toBe(true)
  })

  it('reuses the assigned house on retry (no duplicate) and can succeed', async () => {
    wire({ id: 1, name: 'Rosa Vance', email: 'rosa@perchtrail.example', welcome_sent_at: null, assigned_qr_code_id: 'ABC12' })
    sendEmailMock.mockResolvedValue({ id: 'email-456' })

    const { pickUnusedQrCode } = jest.requireMock('@/lib/approval') as { pickUnusedQrCode: jest.Mock }
    const res = await POST(req(), { params })
    expect(res.status).toBe(200)
    expect((await res.json()).resent).toBe(true)
    // Must NOT mint a new QR/house when one is already assigned.
    expect(pickUnusedQrCode).not.toHaveBeenCalled()
  })
})
