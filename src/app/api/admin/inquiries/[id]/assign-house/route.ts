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
  const inquiryId = parseInt(id, 10)
  if (isNaN(inquiryId)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  let body: { qr_code_id?: string | null }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }) }

  const { qr_code_id } = body

  // null is valid: it unlinks the house
  if (qr_code_id !== null && qr_code_id !== undefined) {
    const { data: house } = await serviceClient()
      .from('houses')
      .select('qr_code_id')
      .eq('qr_code_id', qr_code_id)
      .single()
    if (!house) return NextResponse.json({ error: 'house_not_found' }, { status: 404 })
  }

  const { error } = await serviceClient()
    .from('inquiries')
    .update({ assigned_qr_code_id: qr_code_id ?? null })
    .eq('id', inquiryId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
