import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { getServerEnv, siteUrl } from '@/lib/env'
import { sendEmail } from '@/lib/email'
import { buildNewItemsDigest, type DigestInquiry, type DigestRequest, type DigestUnreviewedHouse } from '@/lib/digest'

// Runs daily at 13:00 UTC (vercel.json). Sends nothing when there is nothing new.
export async function GET(request: NextRequest) {
  const secret = getServerEnv('CRON_SECRET')
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()

  const [
    { data: inquiries, error: inquiriesError },
    { data: requests, error: requestsError },
    { data: unreviewedHouses, error: unreviewedHousesError },
  ] = await Promise.all([
    supabase
      .from('inquiries')
      .select('id, name, category, created_at')
      .eq('status', 'new')
      .is('archived_at', null),
    supabase
      .from('profile_requests')
      .select('id, requester_name, created_at, type')
      .eq('status', 'pending'),
    supabase
      .from('houses')
      .select('qr_code_id, slug, artist_name, unreviewed_publish_source')
      .not('unreviewed_publish_at', 'is', null)
      .eq('status', 'live')
      .is('archived_at', null),
  ])

  if (inquiriesError || requestsError || unreviewedHousesError) {
    console.error('new-inquiries-digest: query failed', { inquiriesError, requestsError, unreviewedHousesError })
    return NextResponse.json({ sent: false, reason: 'query_error' }, { status: 500 })
  }

  const digest = buildNewItemsDigest({
    inquiries: (inquiries ?? []) as DigestInquiry[],
    requests: (requests ?? []) as DigestRequest[],
    unreviewedHouses: (unreviewedHouses ?? []) as DigestUnreviewedHouse[],
    adminUrl: `${siteUrl()}/admin`,
    now: new Date(),
  })

  if (!digest) {
    return NextResponse.json({ sent: false, reason: 'no_new_items' })
  }

  const adminEmail = getServerEnv('ADMIN_NOTIFY_EMAIL')
  if (!adminEmail) {
    return NextResponse.json({ sent: false, reason: 'no_admin_email_configured' })
  }

  await sendEmail({ to: adminEmail, subject: digest.subject, html: digest.html, text: digest.text })

  return NextResponse.json({
    sent: true,
    inquiryCount: inquiries?.length ?? 0,
    requestCount: requests?.length ?? 0,
    unreviewedHouseCount: unreviewedHouses?.length ?? 0,
  })
}
