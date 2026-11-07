/**
 * @jest-environment node
 */
const sendEmailMock = jest.fn(async (_msg: unknown) => ({ id: 'email-1' }))
jest.mock('./email', () => ({ sendEmail: (msg: unknown) => sendEmailMock(msg) }))

let mockAdminNotifyEmail: string | undefined
jest.mock('./env', () => ({
  getServerEnv: (key: string) => (key === 'ADMIN_NOTIFY_EMAIL' ? mockAdminNotifyEmail : ''),
  siteUrl: () => 'https://perchtrail.example',
}))

// next/server's after() needs a request context that Jest does not provide.
// The mock captures the callback so tests can assert the send is deferred.
let capturedAfterCallback: (() => void | Promise<void>) | null = null
jest.mock('next/server', () => ({
  after: (fn: () => void | Promise<void>) => { capturedAfterCallback = fn },
}))

import { notifyAdmin } from './admin-notify'

describe('notifyAdmin', () => {
  beforeEach(() => {
    sendEmailMock.mockClear()
    mockAdminNotifyEmail = 'admin@example.com'
    capturedAfterCallback = null
  })

  it('defers the send via after() instead of firing it synchronously', () => {
    notifyAdmin({ kind: 'inquiry', name: 'Rosa Vance', email: 'rosa@perchtrail.example', category: 'volunteer', adminUrl: 'https://x/admin?tab=inquiries' })
    expect(capturedAfterCallback).not.toBeNull()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('sends to the configured admin address with subject/html/text built from opts, once after() fires', async () => {
    notifyAdmin({ kind: 'inquiry', name: 'Rosa Vance', email: 'rosa@perchtrail.example', category: 'volunteer', adminUrl: 'https://x/admin?tab=inquiries' })
    await capturedAfterCallback!()

    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const call = sendEmailMock.mock.calls[0][0] as { to: string; subject: string; html: string; text: string }
    expect(call.to).toBe('admin@example.com')
    expect(call.subject).toContain('Rosa Vance')
    expect(call.html).toContain('New inquiry')
    expect(call.text).toContain('Rosa Vance')
  })

  it('is a no-op when ADMIN_NOTIFY_EMAIL is unset', () => {
    mockAdminNotifyEmail = undefined
    notifyAdmin({ kind: 'new_profile', name: 'Otis Fenwick', adminUrl: 'https://x/admin?tab=new' })
    expect(capturedAfterCallback).toBeNull()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('catches and logs instead of throwing when sendEmail rejects inside the after() callback', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    sendEmailMock.mockRejectedValueOnce(new Error('boom'))
    notifyAdmin({ kind: 'edit', name: 'Kiln Fire', adminUrl: 'https://x/admin?tab=edits' })

    await expect(capturedAfterCallback!()).resolves.toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Admin notify failed:', expect.any(Error))
    consoleErrorSpy.mockRestore()
  })
})
