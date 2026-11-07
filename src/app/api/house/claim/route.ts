import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'
import { checkEditCode, editCodeFailureResponse } from '@/lib/steward-edit-auth'
import { slugify } from '@/lib/slug'
import { isSupportedLocale } from '@/lib/translation'

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  // Claim is authenticated by the edit code, so it shares the stewardEdit
  // budget with update and images rather than the tight anonymous bucket.
  const { allowed, retryAfterSeconds } = checkRateLimit(ip, 'stewardEdit', RateLimitPresets.stewardEdit)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  let body: {
    qr_code_id: string
    edit_code: string
    slug?: string
    artist_name?: string
    artist_bio?: string
    bio?: string
    lat?: number | null
    lng?: number | null
    locale?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { qr_code_id, edit_code } = body

  if (!qr_code_id || typeof qr_code_id !== 'string' || qr_code_id.length > 5) {
    return NextResponse.json({ error: 'Invalid access' }, { status: 400 })
  }

  if (!edit_code || typeof edit_code !== 'string' || edit_code.length > 4) {
    return NextResponse.json({ error: 'Invalid edit code' }, { status: 400 })
  }

  const denied = editCodeFailureResponse(await checkEditCode(qr_code_id, edit_code))
  if (denied) return denied

  // A house needs a name to be published: a claim creates a page that
  // can go straight to 'live', so the name is required up front. slugify also
  // rejects reserved/unusable input, not just empty strings.
  const slug = slugify(body.slug)
  if (!slug) {
    return NextResponse.json({ error: 'Name required', needsName: true }, { status: 400 })
  }

  // Check if already claimed
  const { data: existingHouse } = await serviceClient()
    .from('houses')
    .select('qr_code_id')
    .eq('qr_code_id', qr_code_id)
    .single()

  if (existingHouse) {
    return NextResponse.json({ error: 'This birdhouse has already been claimed' }, { status: 409 })
  }

  // Get moderation setting
  const { data: settings } = await serviceClient()
    .from('settings')
    .select('value')
    .eq('key', 'moderation_enabled')
    .single()

  const moderationEnabled = settings?.value === 'true'

  // The bio is authored now, in whatever locale the claimer is browsing.
  const claimLocale = isSupportedLocale(body.locale) ? body.locale : 'en'
  // Claiming with moderation off publishes with zero admin involvement; flag
  // it for the admin notification system.
  const unreviewedPatch = moderationEnabled
    ? {}
    : { unreviewed_publish_at: new Date().toISOString(), unreviewed_publish_source: 'no_moderation_claim' }
  const { error: insertError } = await serviceClient()
    .from('houses')
    .insert({
      qr_code_id,
      slug,
      artist_name: body.artist_name?.trim() || null,
      artist_bio: body.artist_bio?.trim() || null,
      bio: body.bio?.trim() || null,
      bio_source_locale: body.bio?.trim() ? claimLocale : 'en',
      artist_bio_source_locale: body.artist_bio?.trim() ? claimLocale : 'en',
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      status: moderationEnabled ? 'review' : 'live',
      // With moderation on, later edits queue for review as well.
      auto_approve_edits: !moderationEnabled,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...unreviewedPatch,
    })

  if (insertError) {
    console.error('Claim insert error:', insertError.message)
    return NextResponse.json({ error: 'Failed to claim birdhouse' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: moderationEnabled ? 'review' : 'live' })
}
