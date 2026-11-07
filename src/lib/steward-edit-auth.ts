import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'

// Wrong guesses are counted on the qr_codes row by an atomic SQL function, so
// the limit holds across routes, server instances, IPs and parallel requests.
// A correct code resets the counter.
export const EDIT_CODE_MAX_FAILURES = 10
export const EDIT_CODE_LOCK_MS = 15 * 60 * 1000

export type EditCodeCheck = 'ok' | 'invalid' | 'locked' | 'not_found'

/** Check an edit code against its qr_codes row and record the outcome. */
export async function checkEditCode(qr_code_id: string, edit_code: string): Promise<EditCodeCheck> {
  const svc = serviceClient()
  const { data } = await svc
    .from('qr_codes')
    .select('edit_code, failed_attempts, locked_until, retired_at')
    .eq('id', qr_code_id)
    .single()

  // A retired code is never valid again, whatever its edit code.
  if (!data || data.retired_at) return 'not_found'

  const now = Date.now()
  const lockedUntil = data.locked_until ? new Date(data.locked_until).getTime() : 0
  if (lockedUntil > now) return 'locked'

  if (data.edit_code.toUpperCase() === edit_code.toUpperCase()) {
    if (data.failed_attempts || lockedUntil) {
      await svc.from('qr_codes').update({ failed_attempts: 0, locked_until: null }).eq('id', qr_code_id)
    }
    return 'ok'
  }

  // An expired lock starts a fresh count before this failure is added.
  if (lockedUntil) {
    await svc.from('qr_codes').update({ failed_attempts: 0, locked_until: null }).eq('id', qr_code_id)
  }
  const { data: failures } = await svc.rpc('record_edit_code_failure', { p_qr_code_id: qr_code_id })
  if (typeof failures === 'number' && failures >= EDIT_CODE_MAX_FAILURES) {
    await svc
      .from('qr_codes')
      .update({ locked_until: new Date(now + EDIT_CODE_LOCK_MS).toISOString() })
      .eq('id', qr_code_id)
    return 'locked'
  }
  return 'invalid'
}

/** The response a steward route returns for a failed check; null when the check passed. */
export function editCodeFailureResponse(result: EditCodeCheck): NextResponse | null {
  switch (result) {
    case 'ok':
      return null
    case 'not_found':
      return NextResponse.json({ error: 'Invalid access' }, { status: 404 })
    case 'locked':
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(EDIT_CODE_LOCK_MS / 1000) } }
      )
    case 'invalid':
      return NextResponse.json({ error: 'Invalid edit code' }, { status: 403 })
  }
}

/** Apply the stewardEdit rate limit; returns a 429 response when exhausted, else null. */
export function rateLimitResponse(request: NextRequest): NextResponse | null {
  const { allowed, retryAfterSeconds } = checkRateLimit(clientIp(request), 'stewardEdit', RateLimitPresets.stewardEdit)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }
  return null
}
