/**
 * @jest-environment node
 */
import { sendEmail, consoleTransport, type EmailTransport, type EmailMessage } from './email'

describe('sendEmail', () => {
  it('rejects messages missing required fields', async () => {
    const spy = jest.fn()
    const fake: EmailTransport = async (msg) => {
      spy(msg)
      return { id: 'x' }
    }

    const r1 = await sendEmail({ to: '', subject: 'hi', html: '<p>hi</p>' }, fake)
    const r2 = await sendEmail({ to: 'a@perchtrail.example', subject: '', html: '<p>hi</p>' }, fake)
    const r3 = await sendEmail({ to: 'a@perchtrail.example', subject: 'hi', html: '' }, fake)

    expect(r1).toHaveProperty('error')
    expect(r2).toHaveProperty('error')
    expect(r3).toHaveProperty('error')
    expect(spy).not.toHaveBeenCalled()
  })

  it('delegates valid messages to the transport', async () => {
    const fake = jest.fn<Promise<{ id: string }>, [EmailMessage]>().mockResolvedValue({ id: 'abc' })
    const r = await sendEmail(
      { to: 'a@perchtrail.example', subject: 'hi', html: '<p>hi</p>', replyTo: 'reply@perchtrail.example' },
      fake as unknown as EmailTransport
    )
    expect(r).toEqual({ id: 'abc' })
    expect(fake).toHaveBeenCalledWith({
      to: 'a@perchtrail.example',
      subject: 'hi',
      html: '<p>hi</p>',
      replyTo: 'reply@perchtrail.example',
    })
  })

  it('propagates transport errors without throwing', async () => {
    const broken: EmailTransport = async () => ({ error: 'boom' })
    const r = await sendEmail({ to: 'a@perchtrail.example', subject: 'hi', html: '<p>hi</p>' }, broken)
    expect(r).toEqual({ error: 'boom' })
  })
})

describe('consoleTransport', () => {
  it('does not attempt a real send and redacts the recipient in logs', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const r = await consoleTransport({
        to: 'pat@perchtrail.example',
        subject: 'test',
        html: '<p>hi</p>',
      })
      expect(r).toHaveProperty('id')
      expect(log).toHaveBeenCalledTimes(1)
      const logged = JSON.stringify(log.mock.calls[0])
      expect(logged).not.toContain('pat@perchtrail.example')
      expect(logged).toContain('p***@perchtrail.example')
    } finally {
      log.mockRestore()
    }
  })
})
