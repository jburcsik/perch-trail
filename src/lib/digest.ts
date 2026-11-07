// Daily digest of unhandled new items: pure functions, easy to unit-test.

import { emailShell, ctaButton, escapeHtml } from './email-templates'
import { UNREVIEWED_SOURCE_LABEL } from './unreviewed-publish'

export type DigestInquiry = { id: number; name: string; category: string | null; created_at: string }
export type DigestRequest = { id: string; requester_name: string; created_at: string; type: 'new_profile' | 'edit' }
export type DigestUnreviewedHouse = {
  qr_code_id: string
  slug: string | null
  artist_name: string | null
  unreviewed_publish_source: string | null
}

// Age in UTC calendar days, so an item created late yesterday reads as one day old.
function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function formatAge(createdAt: string, now: Date): string {
  const days = Math.round((utcMidnight(now) - utcMidnight(new Date(createdAt))) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'today'
  return days === 1 ? '1 day ago' : `${days} days ago`
}

function inquiriesSection(inquiries: DigestInquiry[], adminUrl: string, now: Date) {
  const itemsHtml = inquiries
    .map((i) => {
      const category = i.category ? `: ${escapeHtml(i.category)}` : ''
      return `<p style="margin:0 0 8px; line-height:1.6;">${escapeHtml(i.name)}${category} (${formatAge(i.created_at, now)})</p>`
    })
    .join('')
  const itemsText = inquiries.map((i) => `- ${i.name}${i.category ? `: ${i.category}` : ''} (${formatAge(i.created_at, now)})`)

  return {
    html: `<h2 style="font-size:18px; margin:24px 0 12px; color:#111827;">New inquiries</h2>
        ${itemsHtml}
        ${ctaButton(`${adminUrl}?tab=inquiries`, 'Review inquiries')}`,
    text: ['New inquiries:', ...itemsText, '', `Review inquiries: ${adminUrl}?tab=inquiries`].join('\n'),
  }
}

function requestsSection(requests: DigestRequest[], adminUrl: string, now: Date) {
  const itemsHtml = requests
    .map((r) => `<p style="margin:0 0 8px; line-height:1.6;">${escapeHtml(r.requester_name)} (${formatAge(r.created_at, now)})</p>`)
    .join('')
  const itemsText = requests.map((r) => `- ${r.requester_name} (${formatAge(r.created_at, now)})`)

  return {
    html: `<h2 style="font-size:18px; margin:24px 0 12px; color:#111827;">New perch requests</h2>
        ${itemsHtml}
        ${ctaButton(`${adminUrl}?tab=new`, 'Review requests')}`,
    text: ['New perch requests:', ...itemsText, '', `Review requests: ${adminUrl}?tab=new`].join('\n'),
  }
}

function unreviewedHousesSection(houses: DigestUnreviewedHouse[], adminUrl: string) {
  const itemsHtml = houses
    .map((h) => {
      const name = h.artist_name || h.slug || h.qr_code_id
      const label = (h.unreviewed_publish_source && UNREVIEWED_SOURCE_LABEL[h.unreviewed_publish_source]) || 'Published without review'
      return `<p style="margin:0 0 8px; line-height:1.6;">${escapeHtml(name)}: ${escapeHtml(label)}</p>`
    })
    .join('')
  const itemsText = houses.map((h) => {
    const name = h.artist_name || h.slug || h.qr_code_id
    const label = (h.unreviewed_publish_source && UNREVIEWED_SOURCE_LABEL[h.unreviewed_publish_source]) || 'Published without review'
    return `- ${name}: ${label}`
  })

  return {
    html: `<h2 style="font-size:18px; margin:24px 0 12px; color:#111827;">Went live without review</h2>
        ${itemsHtml}
        ${ctaButton(`${adminUrl}?tab=live`, 'Review live houses')}`,
    text: ['Went live without review:', ...itemsText, '', `Review live houses: ${adminUrl}?tab=live`].join('\n'),
  }
}

export function buildNewItemsDigest(opts: {
  inquiries: DigestInquiry[]
  requests: DigestRequest[]
  unreviewedHouses?: DigestUnreviewedHouse[]
  adminUrl: string
  now: Date
}): { subject: string; html: string; text: string } | null {
  const { inquiries, requests, unreviewedHouses = [], adminUrl, now } = opts
  const total = inquiries.length + requests.length + unreviewedHouses.length
  if (total === 0) return null

  const subject = `Daily check-in: ${total} new item${total === 1 ? '' : 's'} waiting`

  const sections = []
  if (inquiries.length > 0) sections.push(inquiriesSection(inquiries, adminUrl, now))
  if (requests.length > 0) sections.push(requestsSection(requests, adminUrl, now))
  if (unreviewedHouses.length > 0) sections.push(unreviewedHousesSection(unreviewedHouses, adminUrl))

  const bodyHtml = `<h1 style="font-size:22px; margin:0 0 8px; color:#111827;">Your morning check-in: ${total} item${total === 1 ? '' : 's'} waiting</h1>
        ${sections.map((s) => s.html).join('')}`

  const text = [
    `Your morning check-in: ${total} item${total === 1 ? '' : 's'} waiting`,
    '',
    ...sections.map((s) => s.text),
  ].join('\n')

  return {
    subject,
    html: emailShell({ bodyHtml }),
    text,
  }
}
