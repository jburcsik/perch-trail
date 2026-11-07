/**
 * @jest-environment node
 */
import {
  emailShell,
  ctaButton,
  escapeHtml,
  inquiryReplyEmailHtml,
  adminNotificationEmailHtml,
  adminNotificationEmailText,
  adminNotificationSubject,
} from './email-templates'

describe('escapeHtml', () => {
  it('escapes html-significant characters', () => {
    expect(escapeHtml('<script>&"\'</script>')).toBe('&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;')
  })
})

describe('emailShell', () => {
  it('contains the cream background and amber border colors', () => {
    const html = emailShell({ bodyHtml: '<p>hi</p>' })
    expect(html).toContain('#fdf6ec')
    expect(html).toContain('#fde68a')
  })

  it('uses the horizontal logo image', () => {
    const html = emailShell({ bodyHtml: '<p>hi</p>' })
    expect(html).toContain('email-logo-horizontal.png')
    expect(html).not.toContain('hero-desktop.png')
  })

  it('ships both light and dark logo images, swapped via prefers-color-scheme', () => {
    const html = emailShell({ bodyHtml: '<p>hi</p>' })
    expect(html).toContain('email-logo-horizontal.png')
    expect(html).toContain('email-logo-horizontal-dark.png')
    expect(html).toContain('class="pp-logo-light"')
    expect(html).toContain('class="pp-logo-dark"')
    expect(html).toContain('@media (prefers-color-scheme: dark)')
    // Some mail apps ignore the media query in dark mode and need their own selector.
    expect(html).toContain('[data-ogsc]')
  })

  it('the dark logo also has an inline display:none fallback, in case a client strips <style>', () => {
    const html = emailShell({ bodyHtml: '<p>hi</p>' })
    const darkImgTag = html.match(/<img[^>]*class="pp-logo-dark"[^>]*>/)?.[0]
    expect(darkImgTag).toBeDefined()
    expect(darkImgTag).toMatch(/style="[^"]*display:\s*none/)
  })

  it('wraps bodyHtml verbatim', () => {
    const html = emailShell({ bodyHtml: '<p id="marker">unique-body-content</p>' })
    expect(html).toContain('<p id="marker">unique-body-content</p>')
  })
})

describe('ctaButton', () => {
  it('renders the href and amber background', () => {
    const html = ctaButton('https://example.com/go', 'Click me')
    expect(html).toContain('href="https://example.com/go"')
    expect(html).toContain('#d97706')
    expect(html).toContain('Click me')
  })

  it('escapes the label', () => {
    const html = ctaButton('https://example.com/go', '<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('inquiryReplyEmailHtml', () => {
  it('renders the greeting and message paragraphs inside the shell', () => {
    const html = inquiryReplyEmailHtml({ name: 'Rosa Vance', message: 'Line one.\n\nLine two.' })
    expect(html).toContain('Hi Rosa Vance,')
    expect(html).toContain('Line one.')
    expect(html).toContain('Line two.')
    expect(html).toContain('email-logo-horizontal.png')
  })
})

describe('adminNotificationEmailHtml', () => {
  const adminUrl = 'https://perchtrail.example/admin?tab=inquiries'

  it('renders an inquiry notification with name, email, category, and excerpt', () => {
    const html = adminNotificationEmailHtml({
      kind: 'inquiry',
      name: 'Rosa Vance',
      email: 'rosa@perchtrail.example',
      category: 'volunteer',
      excerpt: 'I would love to help out.',
      adminUrl,
    })
    expect(html).toContain('New inquiry')
    expect(html).toContain('Rosa Vance')
    expect(html).toContain('rosa@perchtrail.example')
    expect(html).toContain('volunteer')
    expect(html).toContain('I would love to help out.')
    expect(html).toContain(adminUrl)
    expect(html).toContain('Open admin panel')
  })

  it('omits category when not present', () => {
    const html = adminNotificationEmailHtml({
      kind: 'inquiry',
      name: 'Rosa Vance',
      email: 'rosa@perchtrail.example',
      category: null,
      excerpt: 'Hello there.',
      adminUrl,
    })
    expect(html).not.toContain('null')
  })

  it('escapes a malicious name and message', () => {
    const html = adminNotificationEmailHtml({
      kind: 'inquiry',
      name: '<script>alert(1)</script>',
      email: 'rosa@perchtrail.example',
      category: null,
      excerpt: '<img src=x onerror=alert(2)>',
      adminUrl,
    })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })

  it('truncates a long excerpt at ~300 chars with an ellipsis', () => {
    const longMessage = 'a'.repeat(400)
    const html = adminNotificationEmailHtml({
      kind: 'inquiry',
      name: 'Rosa Vance',
      email: 'rosa@perchtrail.example',
      category: null,
      excerpt: longMessage,
      adminUrl,
    })
    expect(html).toContain('a'.repeat(300))
    expect(html).not.toContain('a'.repeat(301))
    expect(html).toContain('...')
  })

  it('renders a new_profile notification with name and email, no category/excerpt required', () => {
    const html = adminNotificationEmailHtml({
      kind: 'new_profile',
      name: 'Otis Fenwick',
      email: 'sam@example.com',
      adminUrl: 'https://perchtrail.example/admin?tab=new',
    })
    expect(html).toContain('New perch request')
    expect(html).toContain('Otis Fenwick')
    expect(html).toContain('sam@example.com')
  })

  it('renders an edit notification with name only, never an email field', () => {
    const html = adminNotificationEmailHtml({
      kind: 'edit',
      name: 'Kiln Fire',
      email: 'edit-code:ABC12@steward',
      adminUrl: 'https://perchtrail.example/admin?tab=edits',
    })
    expect(html).toContain('Edit awaiting review')
    expect(html).toContain('Kiln Fire')
    expect(html).not.toContain('edit-code:ABC12@steward')
    expect(html).not.toContain('@steward')
  })
})

describe('adminNotificationEmailText', () => {
  it('has no HTML tags', () => {
    const text = adminNotificationEmailText({
      kind: 'inquiry',
      name: 'Rosa Vance',
      email: 'rosa@perchtrail.example',
      category: 'donor',
      excerpt: 'Some message.',
      adminUrl: 'https://perchtrail.example/admin?tab=inquiries',
    })
    expect(text).not.toMatch(/<[a-z]+/i)
    expect(text).toContain('Rosa Vance')
    expect(text).toContain('rosa@perchtrail.example')
    expect(text).toContain('donor')
    expect(text).toContain('Some message.')
  })

  it('omits the email line for edit notifications', () => {
    const text = adminNotificationEmailText({
      kind: 'edit',
      name: 'Kiln Fire',
      email: 'edit-code:ABC12@steward',
      adminUrl: 'https://perchtrail.example/admin?tab=edits',
    })
    expect(text).not.toContain('@steward')
  })
})

describe('adminNotificationSubject', () => {
  it('produces a distinct subject per kind', () => {
    const inquiry = adminNotificationSubject({ kind: 'inquiry', name: 'Rosa Vance' })
    const profile = adminNotificationSubject({ kind: 'new_profile', name: 'Otis Fenwick' })
    const edit = adminNotificationSubject({ kind: 'edit', name: 'Kiln Fire' })
    expect(inquiry).toContain('Rosa Vance')
    expect(profile).toContain('Otis Fenwick')
    expect(edit).toContain('Kiln Fire')
    expect(new Set([inquiry, profile, edit]).size).toBe(3)
  })

  it('includes the category for inquiry subjects, at-a-glance triage', () => {
    const subject = adminNotificationSubject({ kind: 'inquiry', name: 'Rosa Vance', category: 'volunteer' })
    expect(subject).toBe('New inquiry from Rosa Vance (volunteer)')
  })

  it('omits the category parenthetical when absent', () => {
    const subject = adminNotificationSubject({ kind: 'inquiry', name: 'Rosa Vance', category: null })
    expect(subject).toBe('New inquiry from Rosa Vance')
  })

  it('strips embedded newlines from name and category (subject-line safety)', () => {
    const subject = adminNotificationSubject({
      kind: 'inquiry',
      name: 'Rosa Vance\r\nBcc: attacker@evil.example',
      category: 'volunteer\ninjected',
    })
    expect(subject).not.toMatch(/[\r\n]/)
    expect(subject).toBe('New inquiry from Rosa Vance Bcc: attacker@evil.example (volunteer injected)')
  })

  it('strips embedded newlines from new_profile/edit names too', () => {
    expect(adminNotificationSubject({ kind: 'new_profile', name: 'Otis\r\nX' })).not.toMatch(/[\r\n]/)
    expect(adminNotificationSubject({ kind: 'edit', name: 'House\nY' })).not.toMatch(/[\r\n]/)
  })
})
