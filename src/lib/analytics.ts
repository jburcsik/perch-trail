import { sendGAEvent } from '@next/third-parties/google'

/**
 * Custom GA4 events, named to match Google's own "recommended events" schema
 * where one fits (generate_lead, select_content). This gets standard reports
 * and params analysts expect. Deliberately does NOT duplicate GA4 Enhanced
 * Measurement's automatic form_start/form_submit or outbound-click tracking;
 * generate_lead exists specifically because those automatic events are
 * unreliable for our fetch()-based forms (they can't see server-side success).
 */

export type LeadFormName = 'contact' | 'request' | 'recover'

/** Fires once a form's submission is confirmed successful server-side. */
export function trackFormSuccess(formName: LeadFormName, extraParams: Record<string, string> = {}): void {
  sendGAEvent('event', 'generate_lead', { form_name: formName, ...extraParams })
}

export type SelectContentType =
  | 'get_involved_card'
  | 'birdhouse_pin'
  | 'birdhouse_gallery_card'
  | 'birdhouse_profile_link'

/** A user engaged with a specific piece of site content (a card, a map pin, a profile link). */
export function trackSelectContent(contentType: SelectContentType, itemId: string): void {
  sendGAEvent('event', 'select_content', { content_type: contentType, item_id: itemId })
}

/** The language switcher was used. `language` is the locale switched to. */
export function trackLanguageSelect(language: string): void {
  sendGAEvent('event', 'language_select', { language })
}

/** The like/heart button was clicked on a house profile. */
export function trackLikeHouse(houseId: string): void {
  sendGAEvent('event', 'like_house', { item_id: houseId })
}

/** The e-transfer address was copied on the support page. */
export function trackCopyDonationAddress(): void {
  sendGAEvent('event', 'copy_donation_address', {})
}
