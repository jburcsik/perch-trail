import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { checkEditCode, editCodeFailureResponse, rateLimitResponse } from '@/lib/steward-edit-auth'
import { COMPRESSED_IMAGE_EXT } from '@/lib/image-upload-contract'

// Only the extension the client compressor produces is accepted: uploaded
// bytes are not validated against the claimed extension, so accepting more
// would let a caller skip compression and store a full-size original.
const ALLOWED_EXT: Record<string, true> = { [COMPRESSED_IMAGE_EXT]: true }

// Mint a one-time signed upload URL so the steward can upload directly to storage
// without any anon storage-write policy. The edit code is verified here; the
// returned token authorizes exactly one upload to the server-generated path.
export async function POST(request: NextRequest) {
  const blocked = rateLimitResponse(request)
  if (blocked) return blocked

  let body: { qr_code_id: string; edit_code: string; ext: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { qr_code_id, edit_code } = body
  const ext = (body.ext || '').toLowerCase()

  if (typeof qr_code_id !== 'string' || typeof edit_code !== 'string' || !ALLOWED_EXT[ext]) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const denied = editCodeFailureResponse(await checkEditCode(qr_code_id, edit_code))
  if (denied) return denied

  // Server-generated path, always prefixed with the QR id, never client input.
  const storage_path = `${qr_code_id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const svc = serviceClient()
  const { data, error } = await svc.storage
    .from('house-images')
    .createSignedUploadUrl(storage_path)

  if (error || !data) {
    console.error('Signed upload URL error:', error?.message)
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 })
  }

  const { data: urlData } = svc.storage.from('house-images').getPublicUrl(storage_path)

  return NextResponse.json({
    token: data.token,
    path: data.path,
    storage_path,
    image_url: urlData.publicUrl,
  })
}
