import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { siteUrl } from '@/lib/env'
import { parseQrCodeId } from '@/lib/profile-url'
import { generateRandomCode } from '@/lib/qr-reserve'
import { SITE_NAME } from '@/config/site'
import { clientIp } from '@/lib/client-ip'
import { turnstileEnabled, verifyTurnstile } from '@/lib/turnstile'

function recoveryEmailHtml(editUrl: string, editCode: string) {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.55;">
    <p>Here's a new access code for your ${SITE_NAME} profile:</p>
    <p style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; font-family: ui-monospace, Menlo, monospace; font-size: 18px;">
      <strong>${editCode}</strong>
    </p>
    <p>Your previous access code no longer works.</p>
    <p>
      Edit link:<br>
      <a href="${editUrl}" style="color: #b45309; word-break: break-all;">${editUrl}</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      ${SITE_NAME}
    </p>
  </body>
</html>`
}

// The same answer for success and no-match, so the response never says
// which profile URLs are real. A Response body is read once, so build it per call.
const neutral = () => NextResponse.json({
  ok: true,
  message: 'If that profile URL and email match, a new access code is on its way.',
})

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  const { allowed, retryAfterSeconds } = checkRateLimit(ip, 'recovery', RateLimitPresets.recovery)
  if (!allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  let body: { profileUrl?: unknown; email?: unknown; turnstileToken?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const profileUrl = typeof body.profileUrl === 'string' ? body.profileUrl.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : ''

  if (!profileUrl || !email) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  if (turnstileEnabled()) {
    if (!turnstileToken) return NextResponse.json({ error: 'turnstile_missing' }, { status: 400 })
    const ok = await verifyTurnstile(turnstileToken)
    if (!ok) return NextResponse.json({ error: 'turnstile_failed' }, { status: 403 })
  }

  const qrCodeId = parseQrCodeId(profileUrl)
  if (!qrCodeId) return neutral()

  // Match on (assigned_qr_code_id, requester_email)
  const { data: match } = await serviceClient()
    .from('profile_requests')
    .select('id, requester_email')
    .eq('type', 'new_profile')
    .eq('status', 'approved')
    .eq('assigned_qr_code_id', qrCodeId)
    .eq('requester_email', email)
    .maybeSingle()

  if (!match) return neutral()

  // Generate new edit code (collision-resistant loop)
  let newCode = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRandomCode(4)
    const { data: clash } = await serviceClient()
      .from('qr_codes')
      .select('id')
      .eq('edit_code', candidate)
      .maybeSingle()
    if (!clash) {
      newCode = candidate
      break
    }
  }

  if (!newCode) {
    console.error('recovery: could not generate a unique edit code after 5 attempts')
    return neutral()
  }

  const { error: updateErr } = await serviceClient()
    .from('qr_codes')
    .update({ edit_code: newCode, failed_attempts: 0, locked_until: null })
    .eq('id', qrCodeId)

  if (updateErr) {
    console.error('recovery: edit_code update failed:', updateErr.message)
    return neutral()
  }

  const editUrl = `${siteUrl()}/h/${qrCodeId}?edit=${newCode}`
  await sendEmail({
    to: email,
    subject: `Your ${SITE_NAME} access code`,
    html: recoveryEmailHtml(editUrl, newCode),
    text: `Your new access code is ${newCode}\nEdit link: ${editUrl}\nYour previous code no longer works.\n${SITE_NAME}`,
  })

  return neutral()
}
