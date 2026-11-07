import { render, screen } from '@testing-library/react'
import { BirdhousePhoto } from './BirdhousePhoto'
import { IMG_CARD, IMG_HERO, IMG_THUMB } from '@/lib/images'

// Same fixture URL used across src/lib/images.test.ts and markers.test.ts.
const SUPABASE_URL = 'https://example.supabase.co/storage/v1/object/public/house-images/ABC123/1690000000000-photo.jpg'

describe('BirdhousePhoto', () => {
  it('routes the visible photo through the optimizer at the width prop', () => {
    render(<BirdhousePhoto src={SUPABASE_URL} alt="A birdhouse" width={IMG_CARD} />)
    const src = screen.getByAltText('A birdhouse').getAttribute('src') ?? ''
    expect(src).toContain('/_next/image')
    expect(src).toContain(`w=${IMG_CARD}`)
  })

  it('routes the blurred backdrop through the optimizer at IMG_THUMB, regardless of the width prop', () => {
    const { container } = render(<BirdhousePhoto src={SUPABASE_URL} alt="A birdhouse" width={IMG_CARD} />)
    const backdrop = container.querySelector('img[aria-hidden]')
    expect(backdrop).not.toBeNull()
    const src = backdrop!.getAttribute('src') ?? ''
    expect(src).toContain(`w=${IMG_THUMB}`)
    expect(src).not.toContain(`w=${IMG_CARD}`)
  })

  it('requests a different width than the backdrop when the caller asks for IMG_HERO', () => {
    render(<BirdhousePhoto src={SUPABASE_URL} alt="A birdhouse" width={IMG_HERO} />)
    const src = screen.getByAltText('A birdhouse').getAttribute('src') ?? ''
    expect(src).toContain(`w=${IMG_HERO}`)
  })

  it('leaves a local path unrouted through the optimizer, regardless of width', () => {
    render(<BirdhousePhoto src="/default-birdhouse.svg" alt="Local" width={IMG_HERO} />)
    expect(screen.getByAltText('Local')).toHaveAttribute('src', '/default-birdhouse.svg')
  })

  it('falls back to the local illustration, unrouted, when there is no src', () => {
    render(<BirdhousePhoto src={null} alt="No photo" width={IMG_CARD} />)
    expect(screen.getByAltText('No photo')).toHaveAttribute('src', '/default-birdhouse.svg')
  })
})
