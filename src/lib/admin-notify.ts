import { after } from 'next/server'
import { sendEmail } from './email'
import { getServerEnv } from './env'
import {
  adminNotificationEmailHtml,
  adminNotificationEmailText,
  adminNotificationSubject,
  type AdminNotificationOpts,
} from './email-templates'

// Admin notification for a new form submission. No-op without ADMIN_NOTIFY_EMAIL.
// The send runs in Next's after() so a serverless function stays alive until it
// settles, without adding its latency to the response.
export function notifyAdmin(opts: AdminNotificationOpts): void {
  const adminEmail = getServerEnv('ADMIN_NOTIFY_EMAIL')
  if (!adminEmail) return

  after(async () => {
    try {
      await sendEmail({
        to: adminEmail,
        subject: adminNotificationSubject(opts),
        html: adminNotificationEmailHtml(opts),
        text: adminNotificationEmailText(opts),
      })
    } catch (err) {
      console.error('Admin notify failed:', err)
    }
  })
}
