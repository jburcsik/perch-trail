// Branded transactional email templates: pure functions, easy to unit-test.
import { siteUrl } from './env'
import { SITE_NAME } from '@/config/site'

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function logoUrls() {
  const base = siteUrl()
  return { light: `${base}/email-logo-horizontal.png`, dark: `${base}/email-logo-horizontal-dark.png` }
}

/**
 * Shared branded wrapper (cream background, centered card, logo header, footer)
 * around arbitrary pre-built body HTML.
 */
export function emailShell(opts: { bodyHtml: string }) {
  const logo = logoUrls()
  return `<!doctype html>
<html>
  <head>
    <style>
      .pp-logo-dark { display: none !important; }
      @media (prefers-color-scheme: dark) {
        .pp-logo-light { display: none !important; }
        .pp-logo-dark { display: block !important; }
      }
      [data-ogsc] .pp-logo-light { display: none !important; }
      [data-ogsc] .pp-logo-dark { display: block !important; }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#fdf6ec;">
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#1f2937; max-width:560px; margin:0 auto; padding:24px;">
      <!-- Light or dark logo, chosen by the mail client's colour scheme. -->
      <div style="text-align:center; padding:20px 0 12px;">
        <img src="${logo.light}" alt="${escapeHtml(SITE_NAME)}" width="153" height="50" class="pp-logo-light" style="display:block; height:50px; width:auto; max-width:153px; margin:0 auto;">
        <img src="${logo.dark}" alt="${escapeHtml(SITE_NAME)}" width="153" height="50" class="pp-logo-dark" style="display:none; height:50px; width:auto; max-width:153px; margin:0 auto;">
      </div>

      <!-- Card -->
      <div style="background:#ffffff; border:1px solid #fde68a; border-radius:18px; padding:28px;">
        ${opts.bodyHtml}
      </div>

      <p style="text-align:center; font-size:13px; color:#9ca3af; margin:20px 0 0;">${escapeHtml(SITE_NAME)}, a birdhouse-inspired community art experience</p>
    </div>
  </body>
</html>`
}

/** Amber rounded-pill call-to-action button used across all branded emails. */
export function ctaButton(href: string, label: string) {
  return `<div style="text-align:center; margin:24px 0;">
          <a href="${href}" style="display:inline-block; background:#d97706; color:#ffffff; text-decoration:none; font-weight:600; font-size:16px; padding:14px 28px; border-radius:9999px;">${escapeHtml(label)}</a>
        </div>`
}

/** Escape free text and render blank-line-separated paragraphs, single newlines as <br>. */
export function paragraphsToHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px; line-height:1.6;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// Strip embedded newlines for use in a single-line context (email subject).
function singleLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim()
}

export function inquiryReplyEmailHtml(opts: { name: string; message: string }) {
  const { name, message } = opts
  const bodyHtml = `<p style="margin:0 0 16px; line-height:1.6;">Hi ${escapeHtml(name)},</p>
        ${paragraphsToHtml(message)}`

  return emailShell({ bodyHtml })
}

export function inquiryReplyEmailText(opts: { name: string; message: string }) {
  const { name, message } = opts
  return [`Hi ${name},`, '', message, '', `${SITE_NAME}, a birdhouse-inspired community art experience`].join('\n')
}

const ADMIN_NOTIFICATION_HEADINGS = {
  inquiry: 'New inquiry',
  new_profile: 'New perch request',
  edit: 'Edit awaiting review',
} as const

const EXCERPT_MAX = 300

function truncateExcerpt(excerpt: string): string {
  if (excerpt.length <= EXCERPT_MAX) return excerpt
  return `${excerpt.slice(0, EXCERPT_MAX)}...`
}

function excerptToHtml(excerpt: string): string {
  return paragraphsToHtml(truncateExcerpt(excerpt))
}

export type AdminNotificationOpts = {
  kind: 'inquiry' | 'new_profile' | 'edit'
  name: string
  email?: string
  category?: string | null
  excerpt?: string
  adminUrl: string
}

export function adminNotificationEmailHtml(opts: AdminNotificationOpts) {
  const { kind, name, email, category, excerpt, adminUrl } = opts
  const heading = ADMIN_NOTIFICATION_HEADINGS[kind]

  const fields: string[] = []
  fields.push(`<p style="margin:0 0 8px; line-height:1.6;"><strong>Name:</strong> ${escapeHtml(name)}</p>`)
  if (kind !== 'edit' && email) {
    fields.push(`<p style="margin:0 0 8px; line-height:1.6;"><strong>Email:</strong> ${escapeHtml(email)}</p>`)
  }
  if (kind === 'inquiry' && category) {
    fields.push(`<p style="margin:0 0 8px; line-height:1.6;"><strong>Category:</strong> ${escapeHtml(category)}</p>`)
  }

  const excerptHtml =
    kind === 'inquiry' && excerpt
      ? `<p style="margin:16px 0 8px; line-height:1.6;"><strong>Message:</strong></p>${excerptToHtml(excerpt)}`
      : ''

  const bodyHtml = `<h1 style="font-size:22px; margin:0 0 16px; color:#111827;">${escapeHtml(heading)}</h1>
        ${fields.join('')}
        ${excerptHtml}
        ${ctaButton(adminUrl, 'Open admin panel')}`

  return emailShell({ bodyHtml })
}

export function adminNotificationEmailText(opts: AdminNotificationOpts) {
  const { kind, name, email, category, excerpt, adminUrl } = opts
  const heading = ADMIN_NOTIFICATION_HEADINGS[kind]

  const lines = [heading, '', `Name: ${name}`]
  if (kind !== 'edit' && email) lines.push(`Email: ${email}`)
  if (kind === 'inquiry' && category) lines.push(`Category: ${category}`)
  if (kind === 'inquiry' && excerpt) lines.push('', `Message: ${truncateExcerpt(excerpt)}`)
  lines.push('', `Open admin panel: ${adminUrl}`)

  return lines.join('\n')
}

export function adminNotificationSubject(opts: Pick<AdminNotificationOpts, 'kind' | 'name' | 'category'>) {
  const { kind, category } = opts
  const name = singleLine(opts.name)
  if (kind === 'inquiry') {
    const safeCategory = category ? singleLine(category) : null
    return safeCategory ? `New inquiry from ${name} (${safeCategory})` : `New inquiry from ${name}`
  }
  if (kind === 'new_profile') return `New perch request from ${name}`
  return `Edit awaiting review: ${name}`
}
