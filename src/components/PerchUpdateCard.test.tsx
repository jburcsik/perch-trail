import { render, screen } from '@testing-library/react'
import { PerchUpdateCard } from './PerchUpdateCard'
import type { PerchUpdate } from '@/content/perch-updates'

function post(overrides: Partial<PerchUpdate> = {}): PerchUpdate {
  return {
    slug: 'test-post',
    date: '2026-07-13',
    title: { en: 'English Title', fr: 'Titre Fran\u00e7ais', vi: 'Ti\u00eau \u0111\u1ec1 Vi\u1ec7t', 'zh-Hans': '\u4e2d\u6587\u6807\u9898', ar: '\u0639\u0646\u0648\u0627\u0646' },
    body: { en: 'English body.', fr: 'Corps fran\u00e7ais.', vi: 'N\u1ed9i dung Vi\u1ec7t.', 'zh-Hans': '\u4e2d\u6587\u6b63\u6587\u3002', ar: '\u0646\u0635 \u0639\u0631\u0628\u064a.' },
    ...overrides,
  }
}

describe('PerchUpdateCard', () => {
  it('renders the title and body for the given locale, not other locales', () => {
    render(<PerchUpdateCard post={post()} locale="fr" />)
    expect(screen.getByText('Titre Fran\u00e7ais')).toBeInTheDocument()
    expect(screen.getByText('Corps fran\u00e7ais.')).toBeInTheDocument()
    expect(screen.queryByText('English Title')).not.toBeInTheDocument()
  })

  it('renders in each of the 5 supported locales', () => {
    const p = post()
    const locales: Array<keyof PerchUpdate['title']> = ['en', 'fr', 'vi', 'zh-Hans', 'ar']
    for (const locale of locales) {
      const { unmount } = render(<PerchUpdateCard post={p} locale={locale} />)
      expect(screen.getByText(p.title[locale])).toBeInTheDocument()
      unmount()
    }
  })

  it('sets the card id to the post slug (anchor target)', () => {
    const { container } = render(<PerchUpdateCard post={post({ slug: 'my-anchor' })} locale="en" />)
    expect(container.querySelector('#my-anchor')).toBeInTheDocument()
  })

  it('renders no image when the post has no photo', () => {
    render(<PerchUpdateCard post={post()} locale="en" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders the photo when present, using the localized title as alt text', () => {
    render(<PerchUpdateCard post={post({ photo: '/updates/test.jpg' })} locale="en" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/updates/test.jpg')
    expect(img).toHaveAttribute('alt', 'English Title')
  })

  it('renders no link when the post has none', () => {
    render(<PerchUpdateCard post={post()} locale="en" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders an outbound link with the localized label, opening in a new tab', () => {
    render(
      <PerchUpdateCard
        post={post({ link: { url: 'https://example.com/article', label: { en: 'Read the article', fr: 'Lire l\u2019article', vi: '\u0110\u1ecdc b\u00e0i vi\u1ebft', 'zh-Hans': '\u9605\u8bfb\u6587\u7ae0', ar: '\u0627\u0642\u0631\u0623 \u0627\u0644\u0645\u0642\u0627\u0644' } } })}
        locale="en"
      />
    )
    const link = screen.getByRole('link', { name: 'Read the article' })
    expect(link).toHaveAttribute('href', 'https://example.com/article')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('formats the date for the given locale', () => {
    render(<PerchUpdateCard post={post({ date: '2026-07-13' })} locale="en" />)
    expect(screen.getByText('July 13, 2026')).toBeInTheDocument()
  })
})
