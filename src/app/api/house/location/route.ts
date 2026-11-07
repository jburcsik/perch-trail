import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'
import { checkEditCode, editCodeFailureResponse } from '@/lib/steward-edit-auth'

/**
 * Location-only save. Writes lat/lng straight to the house row, bypassing the
 * review queue: a single coordinate is low-risk (not free text/images), the
 * protected content fields are never touched, and a bad pin is trivially
 * re-dragged. Kept separate from /api/house/update so a coordinate nudge can't
 * wipe the steward's other (possibly unsaved) fields.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  const { allowed, retryAfterSeconds } = checkRateLimit(ip, 'stewardEdit', RateLimitPresets.stewardEdit)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  let body: { qr_code_id?: string; edit_code?: string; lat?: number | null; lng?: number | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { qr_code_id, edit_code, lat, lng } = body

  if (!qr_code_id || typeof qr_code_id !== 'string' || qr_code_id.length > 5) {
    return NextResponse.json({ error: 'Invalid access' }, { status: 400 })
  }
  if (!edit_code || typeof edit_code !== 'string' || edit_code.length > 4) {
    return NextResponse.json({ error: 'Invalid edit code' }, { status: 400 })
  }
  const latOk = lat === null || typeof lat === 'number'
  const lngOk = lng === null || typeof lng === 'number'
  if (!latOk || !lngOk) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const denied = editCodeFailureResponse(await checkEditCode(qr_code_id, edit_code))
  if (denied) return denied

  const { data: house, error: houseErr } = await serviceClient()
    .from('houses')
    .select('status')
    .eq('qr_code_id', qr_code_id)
    .single()

  if (houseErr || !house) {
    return NextResponse.json({ error: 'House not found' }, { status: 404 })
  }
  if (house.status === 'suspended') {
    return NextResponse.json({ error: 'Profile is suspended' }, { status: 403 })
  }

  // Touch only lat/lng: never status, never any content field.
  const { error: updateError } = await serviceClient()
    .from('houses')
    .update({ lat: lat ?? null, lng: lng ?? null, updated_at: new Date().toISOString() })
    .eq('qr_code_id', qr_code_id)

  if (updateError) {
    console.error('House location update error:', updateError.message)
    return NextResponse.json({ error: 'Failed to save location' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
