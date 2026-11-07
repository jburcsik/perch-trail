import { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from './email'
import { emailShell, ctaButton, escapeHtml } from './email-templates'
import { siteUrl } from './env'
import { serviceClient } from './supabase-admin'
import { slugify } from './slug'
import { SITE_NAME } from '@/config/site'
// Imported from the dependency-free leaf so this module never pulls sharp into
// the static import graph of the routes that use it (see static-import-graph.ts).
import { COMPRESSED_IMAGE_EXT, UPLOAD_FILE_OPTIONS } from './image-upload-contract'

export type ApprovalResult =
  | { ok: true; qrCodeId: string; editCode: string; emailId: string | null }
  | { ok: false; error: string }

export async function pickUnusedQrCode(supabase: SupabaseClient) {
  // First non-retired code held by no house and no promoted street dot; a
  // promoted marker keeps a unique claim on its code even after a hard delete.
  const { data: codes, error: codesErr } = await supabase
    .from('qr_codes')
    .select('id, edit_code')
    .is('retired_at', null)
    .order('created_at', { ascending: true })
    .limit(1000)
  if (codesErr) return { err: `qr_codes select failed: ${codesErr.message}` } as const

  const { data: used, error: usedErr } = await supabase
    .from('houses')
    .select('qr_code_id')
  if (usedErr) return { err: `houses select failed: ${usedErr.message}` } as const

  const { data: held, error: heldErr } = await supabase
    .from('map_markers')
    .select('promoted_qr_code_id')
    .not('promoted_qr_code_id', 'is', null)
  if (heldErr) return { err: `map_markers select failed: ${heldErr.message}` } as const

  const usedIds = new Set([
    ...(used ?? []).map((h) => h.qr_code_id),
    ...(held ?? []).map((m) => m.promoted_qr_code_id),
  ])
  const free = (codes ?? []).find((c) => !usedIds.has(c.id))
  if (!free) return { err: 'no_unused_qr_codes' } as const
  return { code: free } as const
}

export async function moveRequestPhotoToHouseImages(
  supabase: SupabaseClient,
  requestPhotoPath: string,
  qrCodeId: string
): Promise<{ image_url: string; storage_path: string } | { err: string }> {
  // Download from request-photos
  const { data: blob, error: dlErr } = await supabase.storage
    .from('request-photos')
    .download(requestPhotoPath)
  if (dlErr || !blob) return { err: `photo download failed: ${dlErr?.message ?? 'no data'}` }

  // Normalise to the same WebP profile as the client compressor. sharp is
  // loaded on demand so a missing native binary fails this step, not the route.
  const original = Buffer.from(await blob.arrayBuffer())
  let compressed: Buffer
  try {
    const { compressImageServer } = await import('./image-compression-server')
    compressed = await compressImageServer(original)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return { err: `photo compression failed (sharp): ${detail}` }
  }
  const newPath = `${qrCodeId}/1.${COMPRESSED_IMAGE_EXT}`

  const { error: upErr } = await supabase.storage
    .from('house-images')
    .upload(newPath, compressed, { ...UPLOAD_FILE_OPTIONS, upsert: true })
  if (upErr) return { err: `photo upload failed: ${upErr.message}` }

  const { data: pub } = supabase.storage.from('house-images').getPublicUrl(newPath)
  return { image_url: pub.publicUrl, storage_path: newPath }
}

export function welcomeEmailHtml(opts: {
  name: string
  editUrl: string
}) {
  const { name, editUrl } = opts
  const bodyHtml = `<h1 style="font-size:22px; margin:0 0 8px; color:#111827;">Your perch page is ready to go</h1>
        <p style="margin:0 0 20px; line-height:1.6;">Hi ${escapeHtml(name)}, we've set up your very own perch page, here's how to get started:</p>

        <!-- Steps -->
        <ol style="margin:0 0 20px; padding:0 0 0 20px; line-height:1.8; color:#374151;">
          <li>Click <strong>Edit your profile</strong> below</li>
          <li>Fill in your name, bio, and anything else you'd like to share</li>
          <li>Hit <strong>Save</strong> to submit and put it on the map</li>
        </ol>

        ${ctaButton(editUrl, 'Edit your profile')}

        <p style="margin:0; font-size:14px; color:#6b7280; line-height:1.6;">This is your private edit link: it&apos;s how you get back to your page anytime. Keep it to yourself, unless you&apos;d like someone else to be able to edit your page.</p>

        <p style="margin:20px 0 0; font-size:13px; color:#6b7280; line-height:1.5;">
          Privacy: we keep your email only to help you get back to your page if you lose this link.
        </p>
        <p style="margin:20px 0 0; font-size:13px; color:#9ca3af; text-align:center;">Thanks for joining the trail.</p>`

  return emailShell({ bodyHtml })
}

export function welcomeEmailText(opts: {
  name: string
  editUrl: string
}) {
  const { name, editUrl } = opts
  return [
    `Hi ${name},`,
    ``,
    `We've set up your very own perch page. Here's how to get started:`,
    ``,
    `1. Open your edit link: ${editUrl}`,
    `2. Fill in your name, bio, and whatever you'd like to share`,
    `3. Hit Save to submit and put it on the map`,
    ``,
    `This is your private edit link: it's how you get back to your page anytime. Keep it to yourself, unless you'd like someone else to be able to edit your page.`,
    ``,
    `We keep your email only so we can help you get back to your page if you lose this link.`,
    ``,
    `Thanks for joining the trail.`,
    `${SITE_NAME}, a birdhouse-inspired community art experience`,
  ].join('\n')
}

export function editApprovedEmailHtml(opts: {
  name: string
  profileUrl: string
  editUrl: string
}) {
  const { name, profileUrl, editUrl } = opts
  const bodyHtml = `<h1 style="font-size:22px; margin:0 0 12px; color:#111827;">Your update is live</h1>
        <p style="margin:0 0 20px; line-height:1.6;">Hi ${escapeHtml(name)}, your recent profile changes have been reviewed and approved. Your birdhouse page is now updated.</p>
        ${ctaButton(profileUrl, 'See your profile')}
        <p style="margin:0; font-size:14px; color:#6b7280;">Want to make more changes? <a href="${editUrl}" style="color:#b45309;">Open your edit link</a>.</p>`

  return emailShell({ bodyHtml })
}

export function editApprovedEmailText(opts: {
  name: string
  profileUrl: string
  editUrl: string
}) {
  const { name, profileUrl, editUrl } = opts
  return [
    `Hi ${name},`,
    ``,
    `Your recent profile changes have been reviewed and approved. Your birdhouse page is now updated.`,
    ``,
    `See your profile: ${profileUrl}`,
    `Make more changes: ${editUrl}`,
    ``,
    `${SITE_NAME}, a birdhouse-inspired community art experience`,
  ].join('\n')
}

export const AUTO_APPROVE_THRESHOLD = 3

/**
 * Given the current counter and auto-approve flag, decide what they become after
 * a successful edit approval. Pure function so the behaviour is testable without
 * standing up Supabase.
 */
export function nextEditApprovalState(opts: {
  consecutiveApprovedEdits: number
  autoApproveEdits: boolean
}): { count: number; autoApproveNowOn: boolean; autoApproveAfter: boolean } {
  const count = opts.consecutiveApprovedEdits + 1
  const autoApproveNowOn = !opts.autoApproveEdits && count >= AUTO_APPROVE_THRESHOLD
  return {
    count,
    autoApproveNowOn,
    autoApproveAfter: opts.autoApproveEdits || autoApproveNowOn,
  }
}

export type EditResult =
  | { ok: true; qrCodeId: string; autoApproveNowOn: boolean }
  | { ok: false; error: string }

export async function approveEditRequest(requestId: string, reviewerId: string): Promise<EditResult> {
  const supabase = serviceClient()

  const { data: req, error: reqErr } = await supabase
    .from('profile_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqErr || !req) return { ok: false, error: 'request_not_found' }
  if (req.status !== 'pending') return { ok: false, error: 'already_reviewed' }
  if (req.type !== 'edit') return { ok: false, error: 'wrong_type' }
  if (!req.target_qr_code_id) return { ok: false, error: 'missing_target' }

  const qrCodeId: string = req.target_qr_code_id

  // Load current house to know the counter state
  const { data: house, error: houseErr } = await supabase
    .from('houses')
    .select('consecutive_approved_edits, auto_approve_edits, pending_edit_id')
    .eq('qr_code_id', qrCodeId)
    .single()

  if (houseErr || !house) return { ok: false, error: 'house_not_found' }

  const payload = req.payload ?? {}
  const { count: nextCount, autoApproveNowOn } = nextEditApprovalState({
    consecutiveApprovedEdits: house.consecutive_approved_edits ?? 0,
    autoApproveEdits: Boolean(house.auto_approve_edits),
  })

  // Merge payload into live house + bump counters + clear pointer
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    consecutive_approved_edits: nextCount,
    pending_edit_id: house.pending_edit_id === requestId ? null : house.pending_edit_id,
  }
  if (autoApproveNowOn) update.auto_approve_edits = true
  // Edits only ever target already-live houses (the first-publish flow is handled
  // on the house row directly via status invited/review to live), so there is no
  // draft suspension to lift here.
  if (payload.slug !== undefined) update.slug = slugify(payload.slug)
  if (payload.artist_name !== undefined) update.artist_name = payload.artist_name ?? null
  if (payload.bio !== undefined) update.bio = payload.bio ?? null
  if (payload.artist_bio !== undefined) update.artist_bio = payload.artist_bio ?? null
  // Carry the source language captured at edit time (set per changed field).
  if (payload.bio_source_locale !== undefined) update.bio_source_locale = payload.bio_source_locale
  if (payload.artist_bio_source_locale !== undefined) update.artist_bio_source_locale = payload.artist_bio_source_locale
  if (payload.lat !== undefined) update.lat = payload.lat ?? null
  if (payload.lng !== undefined) update.lng = payload.lng ?? null
  if (payload.tags !== undefined) update.tags = payload.tags ?? []

  const { error: updateErr } = await supabase.from('houses').update(update).eq('qr_code_id', qrCodeId)
  if (updateErr) return { ok: false, error: `house_update_failed: ${updateErr.message}` }

  const { error: markErr } = await supabase
    .from('profile_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
    })
    .eq('id', requestId)
  if (markErr) return { ok: false, error: `request_update_failed: ${markErr.message}` }

  // The steward's email lives on the original new_profile request.
  const { data: origin } = await supabase
    .from('profile_requests')
    .select('requester_email, requester_name')
    .eq('type', 'new_profile')
    .eq('assigned_qr_code_id', qrCodeId)
    .eq('status', 'approved')
    .maybeSingle()

  // Admin-created houses carry a placeholder address on the @steward domain.
  if (origin?.requester_email && !origin.requester_email.includes('@steward')) {
    const base = siteUrl()
    const profileUrl = `${base}/h/${qrCodeId}`
    const { data: qrRow } = await supabase
      .from('qr_codes')
      .select('edit_code')
      .eq('id', qrCodeId)
      .single()
    const editUrl = qrRow ? `${base}/h/${qrCodeId}?edit=${qrRow.edit_code}` : profileUrl
    const name = origin.requester_name || 'Neighbour'
    await sendEmail({
      to: origin.requester_email,
      subject: `Your ${SITE_NAME} profile update is live`,
      html: editApprovedEmailHtml({ name, profileUrl, editUrl }),
      text: editApprovedEmailText({ name, profileUrl, editUrl }),
    })
  }

  return { ok: true, qrCodeId, autoApproveNowOn }
}

export async function denyEditRequest(requestId: string, reviewerId: string, rejectionNote?: string): Promise<EditResult> {
  const supabase = serviceClient()

  const { data: req, error: reqErr } = await supabase
    .from('profile_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqErr || !req) return { ok: false, error: 'request_not_found' }
  if (req.status !== 'pending') return { ok: false, error: 'already_reviewed' }
  if (req.type !== 'edit') return { ok: false, error: 'wrong_type' }
  if (!req.target_qr_code_id) return { ok: false, error: 'missing_target' }

  const qrCodeId: string = req.target_qr_code_id

  // Reset consecutive_approved_edits on deny: the streak is broken.
  const { error: houseErr } = await supabase
    .from('houses')
    .update({ consecutive_approved_edits: 0, pending_edit_id: null })
    .eq('qr_code_id', qrCodeId)
  if (houseErr) return { ok: false, error: `house_reset_failed: ${houseErr.message}` }

  const { error: markErr } = await supabase
    .from('profile_requests')
    .update({
      status: 'denied',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      ...(rejectionNote ? { rejection_note: rejectionNote } : {}),
    })
    .eq('id', requestId)
  if (markErr) return { ok: false, error: `request_update_failed: ${markErr.message}` }

  return { ok: true, qrCodeId, autoApproveNowOn: false }
}

export async function approveNewProfile(requestId: string, reviewerId: string): Promise<ApprovalResult> {
  const supabase = serviceClient()

  // 1. Load the request
  const { data: req, error: reqErr } = await supabase
    .from('profile_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqErr || !req) return { ok: false, error: 'request_not_found' }
  if (req.status !== 'pending') return { ok: false, error: 'already_reviewed' }
  if (req.type !== 'new_profile') return { ok: false, error: 'wrong_type' }
  if (!req.requester_email) return { ok: false, error: 'email_required' }
  // A photo is optional at request time; the map renders a dot until one is added.

  // 2. Pick an unused QR code
  const pick = await pickUnusedQrCode(supabase)
  if ('err' in pick) return { ok: false, error: pick.err ?? 'qr_pick_failed' }
  const { id: qrCodeId, edit_code: editCode } = pick.code

  // 3. Create the house row
  const payload = req.payload ?? {}
  // Approving the request vets the person, so their first edits publish without a second review.
  const { error: houseErr } = await supabase.from('houses').insert({
    qr_code_id: qrCodeId,
    slug: slugify(payload.slug),
    artist_name: payload.artist_name ?? req.requester_name ?? null,
    bio: payload.bio ?? null,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
    status: 'live',
    auto_approve_edits: true,
    claimed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (houseErr) return { ok: false, error: `house_insert_failed: ${houseErr.message}` }

  // 4. Copy an attached photo into house-images.
  if (req.photo_storage_path) {
    const moved = await moveRequestPhotoToHouseImages(supabase, req.photo_storage_path, qrCodeId)
    if ('err' in moved) {
      // The house row exists; the admin can upload the photo again.
      return { ok: false, error: moved.err }
    }
    const { error: imgErr } = await supabase.from('house_images').insert({
      qr_code_id: qrCodeId,
      image_url: moved.image_url,
      storage_path: moved.storage_path,
      display_order: 1,
      uploaded_by: 'admin',
    })
    if (imgErr) return { ok: false, error: `image_insert_failed: ${imgErr.message}` }
  }

  // 5. Mark the request approved
  const { error: markErr } = await supabase
    .from('profile_requests')
    .update({
      status: 'approved',
      assigned_qr_code_id: qrCodeId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
    })
    .eq('id', requestId)
  if (markErr) return { ok: false, error: `request_update_failed: ${markErr.message}` }

  // 6. Send the welcome email
  const base = siteUrl()
  const editUrl = `${base}/h/${qrCodeId}?edit=${editCode}`
  const emailRes = await sendEmail({
    to: req.requester_email,
    subject: `Your ${SITE_NAME} birdhouse profile is ready`,
    html: welcomeEmailHtml({
      name: req.requester_name || 'Neighbour',
      editUrl,
    }),
    text: welcomeEmailText({
      name: req.requester_name || 'Neighbour',
      editUrl,
    }),
  })

  // An email failure does not roll back the approval; the admin can resend.
  const emailId = 'id' in emailRes ? emailRes.id : null
  if (!emailId) {
    console.error('welcome email send failed:', 'error' in emailRes ? emailRes.error : 'unknown')
  }

  return { ok: true, qrCodeId, editCode, emailId }
}
