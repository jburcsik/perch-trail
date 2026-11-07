import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params

  let body: { reason?: unknown } = {}
  try { body = await request.json() } catch { /* empty body is fine */ }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : null

  // Only a published (live) profile can be suspended. This keeps unsuspend correct
  // (restore to live) without tracking a prior status, and matches the model:
  // invited/review houses aren't public, so "delete" is the right tool for them.
  const { data: house } = await serviceClient()
    .from('houses')
    .select('status')
    .eq('qr_code_id', id)
    .single()
  if (!house) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (house.status !== 'live') {
    return NextResponse.json({ error: 'only_live_can_be_suspended' }, { status: 400 })
  }

  const { error } = await serviceClient()
    .from('houses')
    .update({
      status: 'suspended',
      suspended_at: new Date().toISOString(),
      suspended_by: user.id,
      suspended_reason: reason,
    })
    .eq('qr_code_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
