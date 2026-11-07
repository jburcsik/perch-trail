import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await serviceClient()
    .from('houses')
    .update({
      status: 'live',
      suspended_at: null,
      suspended_by: null,
      suspended_reason: null,
    })
    .eq('qr_code_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
