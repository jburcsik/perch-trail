import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { checkEditCode, editCodeFailureResponse, rateLimitResponse } from '@/lib/steward-edit-auth'

// Returns the pending-edit state and any rejection note for the edit page banner.
// Requires a valid edit code so only the steward can read it.
export async function POST(request: NextRequest) {
  const blocked = rateLimitResponse(request)
  if (blocked) return blocked

  let body: { qr_code_id?: string; edit_code?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }) }

  const { qr_code_id, edit_code } = body
  if (!qr_code_id || !edit_code) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

  if (typeof qr_code_id !== 'string' || typeof edit_code !== 'string' || qr_code_id.length > 5 || edit_code.length > 4) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const refused = editCodeFailureResponse(await checkEditCode(qr_code_id, edit_code))
  if (refused) return refused

  // Look up the most recent denied edit for this house
  const { data: denied } = await serviceClient()
    .from('profile_requests')
    .select('id, rejection_note, reviewed_at')
    .eq('target_qr_code_id', qr_code_id)
    .eq('type', 'edit')
    .eq('status', 'denied')
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Look up pending edit
  const { data: house } = await serviceClient()
    .from('houses')
    .select('pending_edit_id')
    .eq('qr_code_id', qr_code_id)
    .single()

  return NextResponse.json({
    pendingEditId: house?.pending_edit_id ?? null,
    lastDenial: denied
      ? { note: denied.rejection_note, reviewedAt: denied.reviewed_at }
      : null,
  })
}
