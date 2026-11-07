import { Resend } from 'resend'
import { getServerEnv, hasServerEnv } from './env'
import { EMAIL_FROM_DEFAULT } from '@/config/site'

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

export type EmailResult = { id: string } | { error: string }

export type EmailTransport = (msg: EmailMessage) => Promise<EmailResult>

const DEFAULT_FROM = EMAIL_FROM_DEFAULT

export const resendTransport: EmailTransport = async (msg) => {
  const apiKey = getServerEnv('RESEND_API_KEY')
  if (!apiKey) return { error: 'RESEND_API_KEY is not configured' }

  const client = new Resend(apiKey)
  const from = msg.from || getServerEnv('EMAIL_FROM') || DEFAULT_FROM
  const replyTo = msg.replyTo || getServerEnv('EMAIL_REPLY_TO') || undefined

  const { data, error } = await client.emails.send({
    from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo,
  })

  if (error) return { error: error.message || 'Unknown Resend error' }
  if (!data?.id) return { error: 'Resend returned no message id' }
  return { id: data.id }
}

export const consoleTransport: EmailTransport = async (msg) => {
  // Dev fallback: never send, just surface the message so it shows up in server logs.
  // Redact the recipient so a shoulder-surfer doesn't leak tester emails.
  const redacted = msg.to.replace(/(.).*(@.*)/, '$1***$2')
  console.log('[email:dev]', { to: redacted, subject: msg.subject })
  return { id: `dev-${Date.now()}` }
}

function pickDefaultTransport(): EmailTransport {
  if (process.env.NODE_ENV === 'production') return resendTransport
  return hasServerEnv('RESEND_API_KEY') ? resendTransport : consoleTransport
}

export async function sendEmail(
  msg: EmailMessage,
  transport: EmailTransport = pickDefaultTransport()
): Promise<EmailResult> {
  if (!msg.to || !msg.subject || !msg.html) {
    return { error: 'sendEmail requires to, subject, and html' }
  }
  return transport(msg)
}
