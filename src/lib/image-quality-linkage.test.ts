/**
 * @jest-environment node
 *
 * HOUSE_IMAGE_QUALITY must be in next.config.ts's images.qualities, or Next rejects
 * every optimizer request with a 400. Imports the real config so drift is caught.
 * Runs under node because next-intl's plugin cannot load under jsdom.
 */
import nextConfig from '../../next.config'
import { HOUSE_IMAGE_QUALITY } from './images'

describe('houseImage quality / next.config.ts qualities linkage', () => {
  it('the quality houseImage emits is present in the qualities array next.config.ts actually declares', () => {
    expect(nextConfig.images?.qualities).toContain(HOUSE_IMAGE_QUALITY)
  })
})
