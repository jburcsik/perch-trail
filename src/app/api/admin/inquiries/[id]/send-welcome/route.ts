import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { pickUnusedQrCode, welcomeEmailHtml, welcomeEmailText } from '@/lib/approval'
import { sendEmail } from '@/lib/email'
import { siteUrl } from '@/lib/env'
import { SITE_NAME } from '@/config/site'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const inquiryId = parseInt(id, 10)
  if (isNaN(inquiryId)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  let force = false
  try { const body = await request.json(); force = body.force === true } catch { /* no body */ }

  // Load the inquiry
  const { data: inquiry, error: inquiryErr } = await serviceClient()
    .from('inquiries')
    .select('id, name, email, welcome_sent_at, assigned_qr_code_id')
    .eq('id', inquiryId)
    .single()

  if (inquiryErr || !inquiry) return NextResponse.json({ error: 'inquiry_not_found' }, { status: 404 })
  if (!inquiry.email) return NextResponse.json({ error: 'inquiry_has_no_email' }, { status: 400 })
  if (inquiry.welcome_sent_at && !force) return NextResponse.json({ error: 'welcome_already_sent' }, { status: 409 })

  const base = siteUrl()
  const reusedHouse = Boolean(inquiry.assigned_qr_code_id)

  // Resolve the house: reuse the one already assigned to this inquiry (resend, or a
  // retry after a previous email failure), otherwise create a fresh 'invited' one.
  // Keying off assigned_qr_code_id (not welcome_sent_at) means a retry never
  // creates a duplicate house, even if the first attempt's email failed.
  let qrCodeId: string
  let editCode: string
  if (inquiry.assigned_qr_code_id) {
    qrCodeId = inquiry.assigned_qr_code_id
    const { data: qrRow } = await serviceClient()
      .from('qr_codes')
      .select('edit_code')
      .eq('id', qrCodeId)
      .single()
    if (!qrRow) return NextResponse.json({ error: 'qr_not_found' }, { status: 404 })
    editCode = qrRow.edit_code
  } else {
    const pick = await pickUnusedQrCode(serviceClient())
    if ('err' in pick) return NextResponse.json({ error: pick.err }, { status: 500 })
    qrCodeId = pick.code.id
    editCode = pick.code.edit_code

    // Create the house as 'invited': the welcome link is out but the steward hasn't
    // filled it in yet, so it's not public. Their first save moves it to 'live' (or
    // 'review' when first-version moderation is on). auto_approve_edits follows the
    // global moderation switch.
    const { data: autoSetting } = await serviceClient()
      .from('settings')
      .select('value')
      .eq('key', 'auto_approve_all_edits')
      .maybeSingle()
    const now = new Date().toISOString()
    const { error: houseErr } = await serviceClient().from('houses').insert({
      qr_code_id: qrCodeId,
      artist_name: inquiry.name || null,
      status: 'invited',
      auto_approve_edits: autoSetting?.value === 'true',
      claimed_at: now,
      updated_at: now,
    })
    if (houseErr) return NextResponse.json({ error: `house_insert_failed: ${houseErr.message}` }, { status: 500 })

    // Link the house to the inquiry now (before sending) so a retry after a failed
    // email reuses this house instead of minting another.
    const { error: linkErr } = await serviceClient()
      .from('inquiries')
      .update({ assigned_qr_code_id: qrCodeId })
      .eq('id', inquiryId)
    if (linkErr) return NextResponse.json({ error: `inquiry_update_failed: ${linkErr.message}` }, { status: 500 })
  }

  // The email IS the deliverable. If Resend doesn't accept it, the whole operation
  // failed; report 502 and leave welcome_sent_at unset so the admin sees the
  // failure and can retry (the house is reused, so no duplicate is created).
  const editUrl = `${base}/h/${qrCodeId}?edit=${editCode}`
  const emailRes = await sendEmail({
    to: inquiry.email,
    subject: `Your ${SITE_NAME} birdhouse profile is ready`,
    html: welcomeEmailHtml({ name: inquiry.name || 'Neighbour', editUrl }),
    text: welcomeEmailText({ name: inquiry.name || 'Neighbour', editUrl }),
  })

  if (!('id' in emailRes)) {
    const reason = 'error' in emailRes ? emailRes.error : 'unknown'
    console.error('welcome email send failed:', reason)
    return NextResponse.json({ error: `email_send_failed: ${reason}`, qrCodeId }, { status: 502 })
  }

  // Email accepted; only now mark the welcome as sent.
  const { error: sentErr } = await serviceClient()
    .from('inquiries')
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq('id', inquiryId)
  if (sentErr) return NextResponse.json({ error: `inquiry_update_failed: ${sentErr.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, qrCodeId, editCode, emailId: emailRes.id, resent: reusedHouse })
}
