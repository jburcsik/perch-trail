import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { approveNewProfile, approveEditRequest, denyEditRequest } from '@/lib/approval'

type Action = 'approve' | 'deny' | 'dismiss' | 'message'

function isAction(value: unknown): value is Action {
  return value === 'approve' || value === 'deny' || value === 'dismiss' || value === 'message'
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  let body: { action?: unknown; message?: unknown; rejectionNote?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (!isAction(body.action)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }

  const { data: req, error: fetchErr } = await serviceClient()
    .from('profile_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !req) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'already_reviewed' }, { status: 409 })
  }

  if (body.action === 'approve') {
    if (req.type === 'new_profile') {
      const result = await approveNewProfile(id, user.id)
      if (!result.ok) {
        const status = result.error === 'request_not_found' ? 404
          : result.error === 'already_reviewed' ? 409
          : 500
        return NextResponse.json({ error: result.error }, { status })
      }
      return NextResponse.json({
        ok: true,
        qrCodeId: result.qrCodeId,
        editCode: result.editCode,
        emailSent: Boolean(result.emailId),
      })
    }

    if (req.type === 'edit') {
      const result = await approveEditRequest(id, user.id)
      if (!result.ok) {
        const status = result.error === 'request_not_found' ? 404
          : result.error === 'already_reviewed' ? 409
          : 500
        return NextResponse.json({ error: result.error }, { status })
      }
      return NextResponse.json({
        ok: true,
        qrCodeId: result.qrCodeId,
        autoApproveNowOn: result.autoApproveNowOn,
      })
    }

    return NextResponse.json({ error: 'wrong_type_for_approve' }, { status: 400 })
  }

  if (body.action === 'deny' || body.action === 'dismiss') {
    const note = typeof body.rejectionNote === 'string' ? body.rejectionNote.trim().slice(0, 1000) : ''

    // Deny requires a rejection note so the owner knows why
    if (body.action === 'deny' && !note) {
      return NextResponse.json({ error: 'rejection_note_required' }, { status: 400 })
    }

    // Edits have special deny behaviour: reset the trust counter on the house.
    if (body.action === 'deny' && req.type === 'edit') {
      const result = await denyEditRequest(id, user.id, note)
      if (!result.ok) {
        const status = result.error === 'request_not_found' ? 404
          : result.error === 'already_reviewed' ? 409
          : 500
        return NextResponse.json({ error: result.error }, { status })
      }
      return NextResponse.json({ ok: true, status: 'denied' })
    }

    const newStatus = body.action === 'deny' ? 'denied' : 'dismissed'
    const { error } = await serviceClient()
      .from('profile_requests')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        ...(note ? { rejection_note: note } : {}),
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    return NextResponse.json({ ok: true, status: newStatus })
  }

  // action === 'message': store an admin note (no email is sent)
  const note = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
  if (!note) return NextResponse.json({ error: 'empty_message' }, { status: 400 })

  const { error } = await serviceClient()
    .from('profile_requests')
    .update({
      admin_note: note,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, noted: true })
}
