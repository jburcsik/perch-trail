import { sendGAEvent } from '@next/third-parties/google'
import {
  trackFormSuccess,
  trackSelectContent,
  trackLanguageSelect,
  trackLikeHouse,
  trackCopyDonationAddress,
} from './analytics'

jest.mock('@next/third-parties/google', () => ({
  sendGAEvent: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('trackFormSuccess', () => {
  it('sends a generate_lead event with the form name', () => {
    trackFormSuccess('request')
    expect(sendGAEvent).toHaveBeenCalledWith('event', 'generate_lead', { form_name: 'request' })
  })

  it('merges extra params (e.g. role) into the event', () => {
    trackFormSuccess('contact', { role: 'volunteer' })
    expect(sendGAEvent).toHaveBeenCalledWith('event', 'generate_lead', { form_name: 'contact', role: 'volunteer' })
  })
})

describe('trackSelectContent', () => {
  it('sends a select_content event with content_type and item_id', () => {
    trackSelectContent('birdhouse_pin', 'ABC12')
    expect(sendGAEvent).toHaveBeenCalledWith('event', 'select_content', { content_type: 'birdhouse_pin', item_id: 'ABC12' })
  })
})

describe('trackLanguageSelect', () => {
  it('sends a language_select event with the target language', () => {
    trackLanguageSelect('fr')
    expect(sendGAEvent).toHaveBeenCalledWith('event', 'language_select', { language: 'fr' })
  })
})

describe('trackLikeHouse', () => {
  it('sends a like_house event with the house id', () => {
    trackLikeHouse('ABC12')
    expect(sendGAEvent).toHaveBeenCalledWith('event', 'like_house', { item_id: 'ABC12' })
  })
})

describe('trackCopyDonationAddress', () => {
  it('sends a copy_donation_address event', () => {
    trackCopyDonationAddress()
    expect(sendGAEvent).toHaveBeenCalledWith('event', 'copy_donation_address', {})
  })
})
