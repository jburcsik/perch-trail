import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  const rl = checkRateLimit(ip, 'likes', RateLimitPresets.likes)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let qrCodeId: string
  try {
    const body = await request.json()
    qrCodeId = body?.qr_code_id
    if (!qrCodeId || typeof qrCodeId !== 'string' || qrCodeId.length > 10) {
      return NextResponse.json({ error: 'invalid_qr_code_id' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // RPC handles the upsert + atomic increment so we don't race with concurrent likes.
  const { data, error } = await serviceClient().rpc('increment_house_likes', { p_qr_code_id: qrCodeId })

  if (error) {
    console.error('Like error:', error.message)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: data })
}
