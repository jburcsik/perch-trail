import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { sendEmail } from '@/lib/email'
import { inquiryReplyEmailHtml, inquiryReplyEmailText } from '@/lib/email-templates'
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

  let body: { message?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }) }

  const message = body.message?.trim()
  if (!message) return NextResponse.json({ error: 'message_required' }, { status: 400 })

  const { data: inquiry, error: inquiryErr } = await serviceClient()
    .from('inquiries')
    .select('id, name, email, status')
    .eq('id', inquiryId)
    .single()

  if (inquiryErr || !inquiry) return NextResponse.json({ error: 'inquiry_not_found' }, { status: 404 })
  if (!inquiry.email) return NextResponse.json({ error: 'no_email' }, { status: 400 })

  const emailRes = await sendEmail({
    to: inquiry.email,
    subject: `Re: Your message to ${SITE_NAME}`,
    html: inquiryReplyEmailHtml({ name: inquiry.name, message }),
    text: inquiryReplyEmailText({ name: inquiry.name, message }),
  })

  const emailId = 'id' in emailRes ? emailRes.id : null
  if (!emailId) {
    const err = 'error' in emailRes ? emailRes.error : 'unknown'
    return NextResponse.json({ error: `email_send_failed: ${err}` }, { status: 500 })
  }

  // Record the reply as a comment so it shows in the thread
  const { error: commentErr } = await serviceClient()
    .from('inquiry_comments')
    .insert({ inquiry_id: inquiryId, comment: message, type: 'reply', sent_email_id: emailId })

  if (commentErr) return NextResponse.json({ error: `comment_insert_failed: ${commentErr.message}` }, { status: 500 })

  // Reopen archived inquiry when admin replies (shows intent to engage)
  if (inquiry.status === 'resolved' || inquiry.status === 'ignored') {
    await serviceClient()
      .from('inquiries')
      .update({ status: 'in_progress', archived_at: null })
      .eq('id', inquiryId)
  }

  return NextResponse.json({ ok: true, emailId })
}
