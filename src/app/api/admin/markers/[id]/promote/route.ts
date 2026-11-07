import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { pickUnusedQrCode } from '@/lib/approval'

/**
 * Promote a street dot to a full birdhouse.
 *
 * Mints a QR + edit code and creates a 'review' house at the marker's exact
 * location. The marker flips to 'promoted' and keeps its admin label, which
 * is deliberately NEVER copied into the house (the label is private; the
 * public name comes from the profile via the name-required gate). The
 * anon RLS policy on map_markers keeps the dot publicly visible until the
 * new house is live, so the birdhouse never vanishes from the map.
 *
 * Routed through the API (not direct client CRUD) because it consumes a QR
 * code; gated by the admin allowlist like the other sensitive ops.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const supabase = serviceClient()

  // 1. Load the marker.
  const { data: marker, error: markerErr } = await supabase
    .from('map_markers')
    .select('id, label, lat, lng, status, promoted_qr_code_id')
    .eq('id', id)
    .single()

  if (markerErr || !marker) return NextResponse.json({ error: 'marker_not_found' }, { status: 404 })
  if (marker.status === 'promoted' || marker.promoted_qr_code_id) {
    return NextResponse.json({ error: 'already_promoted', qrCodeId: marker.promoted_qr_code_id }, { status: 409 })
  }
  if (marker.status !== 'active') {
    return NextResponse.json({ error: 'marker_not_active' }, { status: 400 })
  }

  // 2. Pick an unused QR code (read-only; nothing is consumed until a house
  // row references it).
  const pick = await pickUnusedQrCode(supabase)
  if ('err' in pick) return NextResponse.json({ error: pick.err ?? 'qr_pick_failed' }, { status: 500 })
  const qrCodeId = pick.code.id

  // 3. Claim the marker FIRST, conditionally: this is the idempotency gate.
  // A double-fired promote matches zero rows here and stops before any house
  // exists or QR is consumed. (Two different markers racing to the same QR
  // are stopped by the UNIQUE constraint on promoted_qr_code_id + houses PK;
  // single-admin project, so no heavier locking.)
  const { data: claimed, error: claimErr } = await supabase
    .from('map_markers')
    .update({ status: 'promoted', promoted_qr_code_id: qrCodeId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active')
    .is('promoted_qr_code_id', null)
    .select('id')

  if (claimErr) return NextResponse.json({ error: `marker_update_failed: ${claimErr.message}` }, { status: 500 })
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'already_promoted' }, { status: 409 })
  }

  // 4. Create the house at the dot's location, in 'review': it lands
  // in the Ready for Review bucket for the admin to finish; 'invited' is
  // reserved for stewards holding an emailed edit link. The label is not
  // copied: no artist_name, no slug.
  const now = new Date().toISOString()
  const { error: houseErr } = await supabase.from('houses').insert({
    qr_code_id: qrCodeId,
    status: 'review',
    lat: marker.lat,
    lng: marker.lng,
    claimed_at: now,
    updated_at: now,
  })

  if (houseErr) {
    // Roll the claim back (best effort) so the marker isn't stuck pointing at
    // a house that never got created.
    await supabase
      .from('map_markers')
      .update({ status: 'active', promoted_qr_code_id: null, updated_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ error: `house_insert_failed: ${houseErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, qrCodeId })
}
