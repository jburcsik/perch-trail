/**
 * @jest-environment node
 */
import { buildNewItemsDigest } from './digest'

const NOW = new Date('2026-07-08T13:00:00Z')
const ADMIN_URL = 'https://perchtrail.example/admin'

describe('buildNewItemsDigest', () => {
  it('returns null when inquiries, requests, and unreviewed houses are all empty', () => {
    expect(buildNewItemsDigest({ inquiries: [], requests: [], unreviewedHouses: [], adminUrl: ADMIN_URL, now: NOW })).toBeNull()
  })

  it('defaults unreviewedHouses to empty when the key is omitted', () => {
    expect(buildNewItemsDigest({ inquiries: [], requests: [], adminUrl: ADMIN_URL, now: NOW })).toBeNull()
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: 'Otis Fenwick', category: null, created_at: '2026-07-08T10:00:00Z' }],
      requests: [],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).not.toContain('Went live without review')
  })

  it('returns a digest when only requests are present', () => {
    const result = buildNewItemsDigest({
      inquiries: [],
      requests: [{ id: 'r1', requester_name: 'Rosa Vance', created_at: '2026-07-08T10:00:00Z', type: 'new_profile' }],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result).not.toBeNull()
    expect(result!.html).toContain('Rosa Vance')
    expect(result!.html).not.toContain('New inquiries')
    expect(result!.html).toContain('New perch requests')
  })

  it('returns a digest when only inquiries are present', () => {
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: 'Otis Fenwick', category: 'general', created_at: '2026-07-08T10:00:00Z' }],
      requests: [],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result).not.toBeNull()
    expect(result!.html).toContain('Otis Fenwick')
    expect(result!.html).toContain('New inquiries')
    expect(result!.html).not.toContain('New perch requests')
  })

  it('formats age as "today" for same-day items', () => {
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: 'Otis Fenwick', category: null, created_at: '2026-07-08T02:00:00Z' }],
      requests: [],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).toContain('today')
  })

  it('formats age as singular "1 day ago" for yesterday', () => {
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: 'Otis Fenwick', category: null, created_at: '2026-07-07T10:00:00Z' }],
      requests: [],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).toContain('1 day ago')
  })

  it('formats age as plural "N days ago" for older items', () => {
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: 'Otis Fenwick', category: null, created_at: '2026-07-05T10:00:00Z' }],
      requests: [],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).toContain('3 days ago')
  })

  it('counts by calendar day, not elapsed 24h blocks, across a midnight crossing', () => {
    // Created late the day before yesterday (23:00 UTC), digest runs at 13:00 UTC
    // two calendar days later: only 38 elapsed hours, but a 2-calendar-day gap.
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: 'Otis Fenwick', category: null, created_at: '2026-07-06T23:00:00Z' }],
      requests: [],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).toContain('2 days ago')
    expect(result!.html).not.toContain('1 day ago')
  })

  it('escapes html-significant characters in name and category', () => {
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: '<script>alert(1)</script>', category: '<b>x</b>', created_at: '2026-07-08T10:00:00Z' }],
      requests: [],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).not.toContain('<script>')
    expect(result!.html).toContain('&lt;script&gt;')
    expect(result!.html).not.toContain('<b>x</b>')
  })

  it('pluralizes the subject for multiple items', () => {
    const result = buildNewItemsDigest({
      inquiries: [
        { id: 1, name: 'A', category: null, created_at: '2026-07-08T10:00:00Z' },
        { id: 2, name: 'B', category: null, created_at: '2026-07-08T10:00:00Z' },
      ],
      requests: [],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.subject).toContain('2 new items')
  })

  it('uses singular subject wording for exactly one item', () => {
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: 'A', category: null, created_at: '2026-07-08T10:00:00Z' }],
      requests: [],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.subject).toContain('1 new item')
    expect(result!.subject).not.toContain('1 new items')
  })

  it('links inquiries to the inquiries tab and requests to the new tab', () => {
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: 'A', category: null, created_at: '2026-07-08T10:00:00Z' }],
      requests: [{ id: 'r1', requester_name: 'B', created_at: '2026-07-08T10:00:00Z', type: 'edit' }],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).toContain(`${ADMIN_URL}?tab=inquiries`)
    expect(result!.html).toContain(`${ADMIN_URL}?tab=new`)
  })

  it('builds an equivalent plain-text variant', () => {
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: 'Otis Fenwick', category: 'general', created_at: '2026-07-08T10:00:00Z' }],
      requests: [{ id: 'r1', requester_name: 'Rosa Vance', created_at: '2026-07-07T10:00:00Z', type: 'new_profile' }],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.text).toContain('Otis Fenwick')
    expect(result!.text).toContain('Rosa Vance')
    expect(result!.text).toContain(`${ADMIN_URL}?tab=inquiries`)
    expect(result!.text).toContain(`${ADMIN_URL}?tab=new`)
  })

  // Houses that went live without review are listed daily until acknowledged.
  it('returns a digest when only unreviewed-publish houses are present', () => {
    const result = buildNewItemsDigest({
      inquiries: [],
      requests: [],
      unreviewedHouses: [{ qr_code_id: 'ABCDE', slug: 'orchard-lantern', artist_name: 'Mara Linden', unreviewed_publish_source: 'auto_approve_edit' }],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result).not.toBeNull()
    expect(result!.html).toContain('Mara Linden')
    expect(result!.html).toContain('Went live without review')
  })

  it('labels the source of each unreviewed publish', () => {
    const result = buildNewItemsDigest({
      inquiries: [],
      requests: [],
      unreviewedHouses: [
        { qr_code_id: 'A1', slug: 'a-house', artist_name: 'Auto Approved', unreviewed_publish_source: 'auto_approve_edit' },
        { qr_code_id: 'B2', slug: 'b-house', artist_name: 'No Moderation', unreviewed_publish_source: 'no_moderation_claim' },
      ],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).toContain('Auto-approved edit')
    expect(result!.html).toContain('Claimed with moderation off')
  })

  it('falls back to the slug when a house has no artist name', () => {
    const result = buildNewItemsDigest({
      inquiries: [],
      requests: [],
      unreviewedHouses: [{ qr_code_id: 'A1', slug: 'a-house', artist_name: null, unreviewed_publish_source: 'auto_approve_edit' }],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).toContain('a-house')
  })

  it('counts unreviewed-publish houses toward the subject total', () => {
    const result = buildNewItemsDigest({
      inquiries: [{ id: 1, name: 'Otis Fenwick', category: null, created_at: '2026-07-08T10:00:00Z' }],
      requests: [],
      unreviewedHouses: [{ qr_code_id: 'A1', slug: 'a-house', artist_name: 'Auto Approved', unreviewed_publish_source: 'auto_approve_edit' }],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.subject).toContain('2 new items')
  })

  it('links unreviewed-publish houses to the live tab', () => {
    const result = buildNewItemsDigest({
      inquiries: [],
      requests: [],
      unreviewedHouses: [{ qr_code_id: 'A1', slug: 'a-house', artist_name: 'Auto Approved', unreviewed_publish_source: 'auto_approve_edit' }],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).toContain(`${ADMIN_URL}?tab=live`)
  })

  it('escapes html-significant characters in unreviewed-publish house names', () => {
    const result = buildNewItemsDigest({
      inquiries: [],
      requests: [],
      unreviewedHouses: [{ qr_code_id: 'A1', slug: 'a-house', artist_name: '<script>alert(1)</script>', unreviewed_publish_source: 'auto_approve_edit' }],
      adminUrl: ADMIN_URL,
      now: NOW,
    })
    expect(result!.html).not.toContain('<script>')
    expect(result!.html).toContain('&lt;script&gt;')
  })
})
