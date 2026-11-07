import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { checkRateLimit, peekRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'
import { checkEditCode, editCodeFailureResponse } from '@/lib/steward-edit-auth'

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  // Per-IP throttle on failed attempts only, in two tiers: the per-minute cap
  // stops a fast scan, the 15-minute cap tolerates a shared IP. The per-code
  // lockout in checkEditCode is the limit that holds across IPs and instances.
  const tooMany = () => NextResponse.json(
    { error: 'Too many attempts. Please try again later.' },
    { status: 429, headers: { 'Retry-After': '900' } }
  )
  const failBlocked =
    !peekRateLimit(ip, 'editVerifyFail15m', RateLimitPresets.editVerifyFail).allowed ||
    !peekRateLimit(ip, 'editVerifyFail1m', RateLimitPresets.editVerifyFailPerMinute).allowed
  const recordFailure = () => {
    checkRateLimit(ip, 'editVerifyFail15m', RateLimitPresets.editVerifyFail)
    checkRateLimit(ip, 'editVerifyFail1m', RateLimitPresets.editVerifyFailPerMinute)
  }

  let qr_code_id: string
  let edit_code: string

  try {
    const body = await request.json()
    qr_code_id = body?.qr_code_id
    edit_code = body?.edit_code
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!qr_code_id || typeof qr_code_id !== 'string' || qr_code_id.length > 5) {
    return NextResponse.json({ error: 'Invalid access' }, { status: 400 })
  }

  if (!edit_code || typeof edit_code !== 'string' || edit_code.length > 4) {
    return NextResponse.json({ error: 'Invalid edit code' }, { status: 400 })
  }

  if (failBlocked) return tooMany()

  const check = await checkEditCode(qr_code_id, edit_code)
  if (check !== 'ok') {
    recordFailure()
    return editCodeFailureResponse(check)!
  }

  // The house is read with the service role because pre-publish houses
  // (status invited or review) are hidden from the anon client by RLS.
  // `house: null` means the code is valid but unclaimed, so the page shows
  // the claim form. Moderation fields (suspended_by, suspended_reason,
  // pending_edit_id, consecutive_approved_edits) are never returned here.
  const { data: house } = await serviceClient()
    .from('houses')
    .select('qr_code_id, slug, status, artist_name, artist_bio, bio, bio_source_locale, artist_bio_source_locale, lat, lng, include_in_promo, tags, claimed_at, updated_at')
    .eq('qr_code_id', qr_code_id)
    .maybeSingle()

  const { data: images } = house
    ? await serviceClient()
        .from('house_images')
        .select('*')
        .eq('qr_code_id', qr_code_id)
        .order('display_order', { ascending: true })
    : { data: [] }

  return NextResponse.json({ ok: true, house: house ?? null, images: images ?? [] })
}
