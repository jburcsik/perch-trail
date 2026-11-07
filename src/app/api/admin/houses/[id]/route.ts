import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'

// DELETE /api/admin/houses/[id]
// Hard delete (permanent): removes the house row, cascades to house_images, and
// retires the QR code so it can never be reassigned. Caller MUST send a header
// `X-Confirm-Slug: <slug-or-qr_code_id>` matching the house: the typed
// confirmation gate from the Danger Zone "delete permanently" modal. The one-click
// soft delete (archive) is handled client-side.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const confirm = request.headers.get('x-confirm-slug')?.trim()
  if (!confirm) {
    return NextResponse.json({ error: 'confirmation_required' }, { status: 400 })
  }

  const supabase = serviceClient()

  // Look up the house and require the confirmation token to match either the
  // qr_code_id or the slug. Stops a fat-fingered DELETE on the wrong row.
  const { data: house } = await supabase
    .from('houses')
    .select('qr_code_id, slug')
    .eq('qr_code_id', id)
    .single()

  if (!house) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (confirm !== house.qr_code_id && confirm !== house.slug) {
    return NextResponse.json({ error: 'confirmation_mismatch' }, { status: 400 })
  }

  // Hard delete: permanent. The photo files go first (the rows cascade with
  // the house). Soft delete (archive) is the one-click default in the UI; this
  // is the typed-confirmation "delete permanently" path.
  const { data: images } = await supabase
    .from('house_images')
    .select('storage_path')
    .eq('qr_code_id', id)
  const paths = (images ?? []).map((i) => i.storage_path).filter(Boolean)
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('house-images').remove(paths)
    if (storageError) console.error('Photo removal before delete failed:', storageError.message)
  }

  const { error: deleteError } = await supabase
    .from('houses')
    .delete()
    .eq('qr_code_id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Tombstone the QR code: retire it permanently so it can never be reused.
  const { error: retireError } = await supabase
    .from('qr_codes')
    .update({
      retired_at: new Date().toISOString(),
      retired_reason: 'profile_deleted',
    })
    .eq('id', id)

  if (retireError) {
    console.error('QR retire after delete failed:', retireError.message)
  }

  // If this house came from a promoted street dot, release the marker
  // back to 'active' so the physical birdhouse stays trackable and the dot
  // can be promoted again; otherwise it holds a dangling UNIQUE claim on the
  // retired code forever.
  const { error: markerError } = await supabase
    .from('map_markers')
    .update({ status: 'active', promoted_qr_code_id: null, updated_at: new Date().toISOString() })
    .eq('promoted_qr_code_id', id)

  if (markerError) {
    console.error('Marker release after delete failed:', markerError.message)
  }

  // The house is gone either way; report a failed cleanup instead of a silent 200.
  return NextResponse.json({
    ok: true,
    qrRetired: !retireError,
    markerReleased: !markerError,
  })
}
