import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'
import { checkEditCode, editCodeFailureResponse } from '@/lib/steward-edit-auth'
import { slugify } from '@/lib/slug'
import { isSupportedLocale } from '@/lib/translation'
import { notifyAdmin } from '@/lib/admin-notify'
import { siteUrl } from '@/lib/env'

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  const { allowed, retryAfterSeconds } = checkRateLimit(ip, 'stewardEdit', RateLimitPresets.stewardEdit)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  let body: {
    qr_code_id: string
    edit_code: string
    slug?: string
    artist_name?: string
    artist_bio?: string
    bio?: string
    lat?: number | null
    lng?: number | null
    tags?: string[]
    locale?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { qr_code_id, edit_code } = body

  if (!qr_code_id || typeof qr_code_id !== 'string' || qr_code_id.length > 5) {
    return NextResponse.json({ error: 'Invalid access' }, { status: 400 })
  }

  if (!edit_code || typeof edit_code !== 'string' || edit_code.length > 4) {
    return NextResponse.json({ error: 'Invalid edit code' }, { status: 400 })
  }

  const denied = editCodeFailureResponse(await checkEditCode(qr_code_id, edit_code))
  if (denied) return denied

  // Validate tags if provided: only allow known non-admin tags
  const STEWARD_TAGS = ['family', 'youth', 'senior', 'mural']
  if (body.tags) {
    const invalidTags = body.tags.filter(t => !STEWARD_TAGS.includes(t))
    if (invalidTags.length > 0) {
      return NextResponse.json({ error: `Invalid tags: ${invalidTags.join(', ')}` }, { status: 400 })
    }
  }

  const proposed = {
    slug: slugify(body.slug),
    artist_name: body.artist_name?.trim().slice(0, 120) || null,
    artist_bio: body.artist_bio?.trim().slice(0, 4000) || null,
    bio: body.bio?.trim().slice(0, 4000) || null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    tags: body.tags ?? [],
  }

  // Look up the house's auto_approve flag; trusted profiles skip the queue.
  // bio/artist_bio are fetched too so we only stamp a field's source locale
  // when its text actually changed (editing artist_name shouldn't re-language
  // the bio).
  const [{ data: house, error: houseErr }, { data: globalSetting }] = await Promise.all([
    serviceClient()
      .from('houses')
      .select('status, auto_approve_edits, artist_name, bio, artist_bio, slug')
      .eq('qr_code_id', qr_code_id)
      .single(),
    serviceClient()
      .from('settings')
      .select('value')
      .eq('key', 'auto_approve_all_edits')
      .maybeSingle(),
  ])

  if (houseErr || !house) {
    return NextResponse.json({ error: 'House not found' }, { status: 404 })
  }

  // Only an admin-suspended (moderated) house blocks steward edits. invited/review
  // houses are pre-publish and the steward MUST be able to edit them; saving is
  // exactly how they fill in and submit their page.
  if (house.status === 'suspended') {
    return NextResponse.json({ error: 'Profile is suspended' }, { status: 403 })
  }

  // Pre-publish flow: the house isn't live yet (link sent = 'invited', or first
  // version submitted = 'review'). There's no public version to protect, so the
  // steward's save lands directly on the house row and moves its status.
  const isPrePublish = house.status === 'invited' || house.status === 'review'

  const autoApprove = house.auto_approve_edits || globalSetting?.value === 'true'

  // Stamp the source language of any field the steward actually re-authored,
  // using the locale they were editing in. Drives translation targets
  // and per-viewer rendering. Unsupported/absent locale falls back to 'en'.
  const editLocale = isSupportedLocale(body.locale) ? body.locale : 'en'
  const sourceLocales: Record<string, string> = {}
  if (proposed.bio !== (house.bio ?? null)) sourceLocales.bio_source_locale = editLocale
  if (proposed.artist_bio !== (house.artist_bio ?? null)) sourceLocales.artist_bio_source_locale = editLocale

  // A house needs a name to be published. A nameless pre-publish save
  // persists the steward's work but never moves status ('invited' stays
  // 'invited', 'review' stays 'review'), so a location-only first save can't
  // put an empty page on the map.
  if (isPrePublish && !proposed.slug) {
    const { error: updateError } = await serviceClient()
      .from('houses')
      .update({ ...proposed, ...sourceLocales, updated_at: new Date().toISOString() })
      .eq('qr_code_id', qr_code_id)

    if (updateError) {
      console.error('House update error:', updateError.message)
      return NextResponse.json({ error: 'Failed to update birdhouse' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, live: false, needsName: true })
  }

  // A live house never loses its name via a blank save; keep the existing slug
  // (covers both the direct update and the queued edit-request payload).
  if (!isPrePublish && !proposed.slug) proposed.slug = house.slug ?? null

  // Auto-approve stewards publish on save. For a pre-publish house that means
  // moving it to 'live' right here, on their first save, with no admin
  // involvement, so flag it for the admin notification system.
  if (autoApprove) {
    const statusPatch = isPrePublish
      ? { status: 'live', unreviewed_publish_at: new Date().toISOString(), unreviewed_publish_source: 'auto_approve_edit' }
      : {}
    const { error: updateError } = await serviceClient()
      .from('houses')
      .update({ ...proposed, ...sourceLocales, ...statusPatch, updated_at: new Date().toISOString() })
      .eq('qr_code_id', qr_code_id)

    if (updateError) {
      console.error('House update error:', updateError.message)
      return NextResponse.json({ error: 'Failed to update birdhouse' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, live: true, slug: proposed.slug })
  }

  // Not auto-approved + pre-publish: this is the steward's first version. Save the
  // content in place and move the house to 'review' for the admin to publish.
  // No edit request: there's no live version to diff against yet.
  if (isPrePublish) {
    const { error: updateError } = await serviceClient()
      .from('houses')
      .update({ ...proposed, ...sourceLocales, status: 'review', updated_at: new Date().toISOString() })
      .eq('qr_code_id', qr_code_id)

    if (updateError) {
      console.error('House review-submit error:', updateError.message)
      return NextResponse.json({ error: 'Failed to submit birdhouse' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, live: false, review: true })
  }

  // Edit review flow: stage the edit as a profile_request.
  // The live profile stays up; admin reviews the diff and approves/denies.
  const { data: inserted, error: insertErr } = await serviceClient()
    .from('profile_requests')
    .insert({
      type: 'edit',
      status: 'pending',
      target_qr_code_id: qr_code_id,
      payload: { ...proposed, ...sourceLocales },
      requester_name: house.artist_name || `steward:${qr_code_id}`,
      requester_email: `edit-code:${qr_code_id}@steward`,
      turnstile_verified: false,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('Edit request insert error:', insertErr?.message)
    return NextResponse.json({ error: 'Failed to queue edit' }, { status: 500 })
  }

  // Replace any previous pending edit with this newer one.
  const { data: existingPointer } = await serviceClient()
    .from('houses')
    .select('pending_edit_id')
    .eq('qr_code_id', qr_code_id)
    .single()

  if (existingPointer?.pending_edit_id && existingPointer.pending_edit_id !== inserted.id) {
    // Superseded: dismiss the older pending edit so it doesn't clutter the queue.
    await serviceClient()
      .from('profile_requests')
      .update({ status: 'dismissed', admin_note: 'Superseded by a newer edit from the same profile.' })
      .eq('id', existingPointer.pending_edit_id)
      .eq('status', 'pending')
  }

  await serviceClient()
    .from('houses')
    .update({ pending_edit_id: inserted.id })
    .eq('qr_code_id', qr_code_id)

  // Fire-and-forget admin notification (never block the steward's save)
  notifyAdmin({
    kind: 'edit',
    name: house.artist_name || house.slug || `steward:${qr_code_id}`,
    adminUrl: `${siteUrl()}/admin?tab=edits`,
  })

  return NextResponse.json({ ok: true, live: false, queued: true, requestId: inserted.id })
}
