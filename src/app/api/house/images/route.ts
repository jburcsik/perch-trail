import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { checkEditCode, editCodeFailureResponse, rateLimitResponse } from '@/lib/steward-edit-auth'

// Create image record (after the client uploads to storage via a signed URL).
// The storage upload itself is authorized by a one-time token minted at
// /api/house/images/sign; anon clients have no direct storage INSERT policy.
export async function POST(request: NextRequest) {
  const blocked = rateLimitResponse(request)
  if (blocked) return blocked

  let body: {
    qr_code_id: string
    edit_code: string
    storage_path: string
    display_order: number
    file_size_kb: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { qr_code_id, edit_code, storage_path, display_order, file_size_kb } = body

  if (typeof qr_code_id !== 'string' || typeof edit_code !== 'string' || typeof storage_path !== 'string') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const denied = editCodeFailureResponse(await checkEditCode(qr_code_id, edit_code))
  if (denied) return denied

  // Validate display_order
  if (!display_order || display_order < 1 || display_order > 3) {
    return NextResponse.json({ error: 'Invalid display order' }, { status: 400 })
  }

  // Verify the storage path belongs to this QR code (prevent cross-house injection)
  if (!storage_path.startsWith(`${qr_code_id}/`)) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 })
  }

  // The public URL is derived from the path on the server so a record can
  // only ever point at this bucket.
  const svc = serviceClient()
  const image_url = svc.storage.from('house-images').getPublicUrl(storage_path).data.publicUrl
  const { data: inserted, error } = await svc
    .from('house_images')
    .insert({
      qr_code_id,
      image_url,
      storage_path,
      display_order,
      uploaded_by: 'steward',
      file_size_kb: file_size_kb || null,
    })
    .select('id, qr_code_id, image_url, storage_path, display_order')
    .single()

  if (error || !inserted) {
    // The file is already in storage (uploaded via the signed URL); the steward's
    // anon client can't delete it, so roll back the orphan here with the service role.
    await svc.storage.from('house-images').remove([storage_path])
    console.error('Image record insert error:', error?.message)
    return NextResponse.json({ error: 'Failed to save image record' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, image: inserted })
}

// Delete image record + storage file
export async function DELETE(request: NextRequest) {
  const blocked = rateLimitResponse(request)
  if (blocked) return blocked

  let body: {
    qr_code_id: string
    edit_code: string
    image_id: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { qr_code_id, edit_code, image_id } = body

  if (typeof qr_code_id !== 'string' || typeof edit_code !== 'string' || typeof image_id !== 'number') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const denied = editCodeFailureResponse(await checkEditCode(qr_code_id, edit_code))
  if (denied) return denied

  // The storage path comes from the record, never from the client, so a
  // steward can only remove files of their own house.
  const { data: imageData } = await serviceClient()
    .from('house_images')
    .select('qr_code_id, storage_path')
    .eq('id', image_id)
    .single()

  if (!imageData || imageData.qr_code_id !== qr_code_id) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  await serviceClient().storage.from('house-images').remove([imageData.storage_path])

  // Delete record
  const { error } = await serviceClient()
    .from('house_images')
    .delete()
    .eq('id', image_id)

  if (error) {
    console.error('Image delete error:', error.message)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
