'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import toast, { Toaster } from 'react-hot-toast'
import { Copy, Check, ChevronDown, MessageSquare, Link2, Lock, Mail, Bell } from 'lucide-react'
import type { ProfileRequest } from '@/lib/types'
import type { HouseStatus } from '@/lib/house-status'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ReplyScriptsPanel } from '@/components/admin/ReplyScriptsPanel'
import { UNREVIEWED_SOURCE_LABEL } from '@/lib/unreviewed-publish'

interface QRCode {
  id: string
  edit_code: string
  created_at: string
}

interface House {
  qr_code_id: string
  slug: string | null
  status: HouseStatus
  pending_edit_id: string | null
  auto_approve_edits: boolean
  artist_name: string | null
  bio: string | null
  artist_bio: string | null
  lat: number | null
  lng: number | null
  include_in_promo: boolean
  is_invited_artist: boolean
  tags: string[]
  claimed_at: string
  updated_at: string
  suspended_at: string | null
  archived_at: string | null
  house_images?: { id: number }[]
  unreviewed_publish_at: string | null
  unreviewed_publish_source: string | null
}

interface Inquiry {
  id: number
  name: string
  email: string
  message: string
  status: 'new' | 'in_progress' | 'pickup_invite_sent' | 'resolved' | 'ignored'
  category: string | null
  archived_at: string | null
  created_at: string
  assigned_qr_code_id: string | null
  welcome_sent_at: string | null
  pickup_invite_sent_at: string | null
}

// A welcome email creates a house and invites a steward, so it is never sent
// automatically. After this delay the inquiry is flagged as ready; the send
// is still a manual click.
const WELCOME_READY_AFTER_MS = 3 * 24 * 60 * 60 * 1000

function isReadyToWelcome(inquiry: Inquiry): boolean {
  if (inquiry.status !== 'pickup_invite_sent') return false
  if (inquiry.welcome_sent_at) return false
  if (!inquiry.pickup_invite_sent_at) return false
  return Date.now() - new Date(inquiry.pickup_invite_sent_at).getTime() >= WELCOME_READY_AFTER_MS
}

// Status values, labels and badge styles, used by the helpers and both dropdowns.
const INQUIRY_STATUSES: { value: 'new' | 'in_progress' | 'pickup_invite_sent' | 'resolved' | 'ignored'; label: string; badgeClass: string }[] = [
  { value: 'new', label: 'New', badgeClass: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'In Progress', badgeClass: 'bg-amber-100 text-amber-800' },
  { value: 'pickup_invite_sent', label: 'Pickup Invite Sent', badgeClass: 'bg-purple-100 text-purple-800' },
  { value: 'resolved', label: 'Resolved', badgeClass: 'bg-green-100 text-green-800' },
  { value: 'ignored', label: 'Ignored', badgeClass: 'bg-gray-100 text-gray-600' },
]

interface InquiryComment {
  id: number
  inquiry_id: number
  comment: string
  type: 'note' | 'reply'
  sent_email_id: string | null
  created_at: string
}

type ReplyScript = { id: string; label: string; body: string; sort_order: number }

type AdminTab = 'new' | 'invited' | 'review' | 'edits' | 'live' | 'suspended' | 'deleted' | 'inquiries' | 'scripts'

const TAB_IDS: AdminTab[] = ['new', 'invited', 'review', 'edits', 'live', 'suspended', 'deleted', 'inquiries', 'scripts']

// Read the active tab from the ?tab= query param (used for shareable / Back-able URLs).
function tabFromUrl(): AdminTab | null {
  if (typeof window === 'undefined') return null
  const t = new URLSearchParams(window.location.search).get('tab')
  return t && (TAB_IDS as string[]).includes(t) ? (t as AdminTab) : null
}

// A single changed field in an edit request: what's live now vs. what's proposed.
type EditDiffRow = { label: string; current: string; proposed: string }

// Compare the live house against an edit request's proposed payload and return
// only the fields that actually changed. Used to render a before/after diff.
function diffEdit(house: House, payload: Record<string, unknown>): EditDiffRow[] {
  const rows: EditDiffRow[] = []
  const norm = (v: unknown): string => {
    if (v == null) return ''
    if (Array.isArray(v)) return v.join(', ')
    if (typeof v === 'number') return String(v)
    return String(v).trim()
  }
  const fields: { key: keyof House; label: string }[] = [
    { key: 'slug', label: 'Name / URL' },
    { key: 'artist_name', label: 'Artist' },
    { key: 'artist_bio', label: 'Artist bio' },
    { key: 'bio', label: 'Bio' },
    { key: 'tags', label: 'Tags' },
  ]
  for (const { key, label } of fields) {
    if (!(key in payload)) continue
    const current = norm(house[key])
    const proposed = norm(payload[key])
    if (current !== proposed) rows.push({ label, current, proposed })
  }
  // Location is a paired lat/lng field.
  if ('lat' in payload || 'lng' in payload) {
    const curLoc = house.lat != null && house.lng != null ? `${house.lat}, ${house.lng}` : ''
    const propLat = 'lat' in payload ? payload.lat : house.lat
    const propLng = 'lng' in payload ? payload.lng : house.lng
    const propLoc = propLat != null && propLng != null ? `${propLat}, ${propLng}` : ''
    if (curLoc !== propLoc) rows.push({ label: 'Location', current: curLoc, proposed: propLoc })
  }
  return rows
}

export default function AdminPage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // QR Codes (for export only)
  const [qrCodes, setQRCodes] = useState<QRCode[]>([])

  // Houses
  const [houses, setHouses] = useState<House[]>([])
  const [invitedHouses, setInvitedHouses] = useState<House[]>([])
  const [reviewHouses, setReviewHouses] = useState<House[]>([])
  const [liveHouses, setLiveHouses] = useState<House[]>([])

  // Settings
  const [moderationEnabled, setModerationEnabled] = useState(true)
  const [autoApproveAllEdits, setAutoApproveAllEdits] = useState(false)

  // Retire house modal state
  const [retireTarget, setRetireTarget] = useState<string | null>(null)
  const [retireReason, setRetireReason] = useState<'behaviour' | 'owner_request' | 'test_duplicate' | 'other'>('behaviour')

  // Live-house notifications: houses published without admin review.
  const [unreviewedDropdownOpen, setUnreviewedDropdownOpen] = useState(false)
  const [ackingUnreviewed, setAckingUnreviewed] = useState<string | null>(null)

  // Copy-to-clipboard flash state: tracks which house+type last copied
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const flashCopy = (key: string, text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success(`${label} copied!`)
    setTimeout(() => setCopiedKey(null), 1800)
  }
  const copyEditUrl = (house: House) => {
    const code = qrCodes.find(q => q.id === house.qr_code_id)?.edit_code
    if (!code) { toast.error('Edit code not loaded'); return }
    const url = `${window.location.origin}/h/${house.qr_code_id}?edit=${code}`
    flashCopy(`edit-${house.qr_code_id}`, url, 'Edit URL')
  }

  // Profile requests (new-profile + edit submissions). The pending buckets live
  // in the New requests / Edits tabs; we keep the full list for action refetches.
  const [requests, setRequests] = useState<ProfileRequest[]>([])
  const [actingRequest, setActingRequest] = useState<string | null>(null)
  const [messageFor, setMessageFor] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [denyFor, setDenyFor] = useState<string | null>(null)
  const [denyNote, setDenyNote] = useState('')

  // Which bucket is visible. Default is chosen once data loads (see effect below).
  const [tab, setTab] = useState<AdminTab>('live')
  const [tabInitialized, setTabInitialized] = useState(false)

  // Inquiries
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [archivedInquiries, setArchivedInquiries] = useState<Inquiry[]>([])
  const [expandedInquiry, setExpandedInquiry] = useState<number | null>(null)
  const [comments, setComments] = useState<Record<number, InquiryComment[]>>({})
  const [newCommentText, setNewCommentText] = useState('')
  // Internal-note composer starts collapsed per inquiry; replying is the common
  // action, notes are occasional, so don't reserve space for it by default.
  const [noteComposerOpen, setNoteComposerOpen] = useState<Record<number, boolean>>({})
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [sendingWelcome, setSendingWelcome] = useState<number | null>(null)
  const [assigningHouse, setAssigningHouse] = useState<number | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({})
  const [sendingReply, setSendingReply] = useState<number | null>(null)
  const [scriptChoice, setScriptChoice] = useState<Record<number, string>>({})
  const [healthError, setHealthError] = useState<string | null>(null)
  const [streetDotCount, setStreetDotCount] = useState<number | null>(null)
  const [replyScripts, setReplyScripts] = useState<ReplyScript[]>([])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      fetchQRCodes()
      fetchHouses()
      fetchSettings()
      fetchInquiries()
      fetchRequests()
      fetchStreetDotCount()
      fetchReplyScripts()
      // Fail loud: confirm the server can actually do service-role writes.
      fetch('/api/health')
        .then(r => r.json())
        .then(d => setHealthError(d?.ok ? null : (d?.detail || 'Server health check failed; admin writes may not work.')))
        .catch(() => setHealthError('Could not reach the server health check.'))
    }
  }, [user])

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('profile_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setRequests(data as ProfileRequest[])
  }

  // POST an action to the approval API, then refresh requests and houses.
  const runRequestAction = async (
    id: string,
    action: 'approve' | 'deny' | 'dismiss' | 'message',
    message?: string,
    rejectionNote?: string,
  ) => {
    setActingRequest(id)
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message, rejectionNote }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg =
          body.error === 'already_reviewed' ? 'Already reviewed'
          : body.error === 'no_unused_qr_codes' ? 'No unused access codes left. Generate more first'
          : 'Action failed'
        toast.error(msg)
        return
      }

      const data = await res.json().catch(() => ({}))
      toast.success(
        action === 'approve' ? (data.emailSent ? 'Approved and emailed' : 'Approved (email failed, check logs)')
        : action === 'deny' ? 'Denied'
        : action === 'dismiss' ? 'Dismissed'
        : action === 'message' ? 'Note saved'
        : 'Done'
      )

      await fetchRequests()
      fetchHouses()
      if (action === 'message') {
        setMessageFor(null)
        setMessageText('')
      }
    } finally {
      setActingRequest(null)
    }
  }

  const fetchStreetDotCount = async () => {
    const { count } = await supabase
      .from('map_markers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
    if (count !== null) setStreetDotCount(count)
  }

  const fetchQRCodes = async () => {
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .order('created_at', { ascending: true })

    if (!error && data) {
      setQRCodes(data)
    }
  }

  const fetchHouses = async () => {
    const { data, error } = await supabase
      .from('houses')
      .select('*, house_images(id)')
      .order('claimed_at', { ascending: false })

    if (!error && data) {
      setHouses(data)
      setInvitedHouses(data.filter(h => h.status === 'invited' && !h.archived_at))
      setReviewHouses(data.filter(h => h.status === 'review' && !h.archived_at))
      setLiveHouses(data.filter(h => h.status === 'live' && !h.archived_at))
    }
  }

  const restoreHouse = async (id: string) => {
    const { error } = await supabase
      .from('houses')
      .update({ archived_at: null })
      .eq('qr_code_id', id)

    if (!error) {
      toast.success('Profile restored')
      fetchHouses()
    } else {
      toast.error('Failed to restore profile')
    }
  }

  // Permanent delete from the Deleted tab: modal yes/no only, no typed house
  // name (that gate stays on the Danger Zone path). The API still requires a
  // confirmation token; we supply the qr_code_id programmatically.
  const [permDeleteTarget, setPermDeleteTarget] = useState<House | null>(null)
  const [permDeleting, setPermDeleting] = useState(false)

  const permDeleteConfirmed = async () => {
    if (!permDeleteTarget || permDeleting) return
    setPermDeleting(true)
    try {
      const res = await fetch(`/api/admin/houses/${permDeleteTarget.qr_code_id}`, {
        method: 'DELETE',
        headers: { 'X-Confirm-Slug': permDeleteTarget.qr_code_id },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ? `Failed to delete: ${body.error}` : 'Failed to delete permanently')
        return
      }
      const body = await res.json().catch(() => ({}))
      if (body.qrRetired === false) {
        toast('Deleted, but the access code could not be retired. Check the logs', { icon: '\u{26A0}\u{FE0F}', duration: 8000 })
      } else {
        toast.success('Deleted permanently. Access code retired')
      }
      setPermDeleteTarget(null)
      fetchHouses()
      fetchQRCodes()
    } finally {
      setPermDeleting(false)
    }
  }

  // One-click soft-delete (no confirmation): move a profile to the Deleted tab.
  // Reversible via Restore there.
  const archiveHouse = async (id: string) => {
    const { error } = await supabase
      .from('houses')
      .update({ archived_at: new Date().toISOString() })
      .eq('qr_code_id', id)

    if (!error) {
      toast.success('Profile deleted')
      fetchHouses()
    } else {
      toast.error('Failed to delete profile')
    }
  }


  const fetchSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['moderation_enabled', 'auto_approve_all_edits'])

    if (data) {
      for (const row of data) {
        if (row.key === 'moderation_enabled') setModerationEnabled(row.value === 'true')
        if (row.key === 'auto_approve_all_edits') setAutoApproveAllEdits(row.value === 'true')
      }
    }
  }

  const fetchInquiries = async () => {
    const { data: active } = await supabase
      .from('inquiries')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false })

    if (active) setInquiries(active)

    const { data: archived } = await supabase
      .from('inquiries')
      .select('*')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })

    if (archived) setArchivedInquiries(archived)
  }

  const fetchReplyScripts = async () => {
    const { data } = await supabase
      .from('reply_scripts')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (data) setReplyScripts(data)
  }

  const updateStatus = async (id: number, status: string) => {
    // Stamp (or re-stamp) pickup_invite_sent_at every time this status is
    // explicitly (re)selected; each selection is a fresh "invite sent" event,
    // and the ready-to-welcome countdown should restart from it.
    const pickupInviteSentAt = status === 'pickup_invite_sent' ? new Date().toISOString() : undefined
    const patch = pickupInviteSentAt ? { status, pickup_invite_sent_at: pickupInviteSentAt } : { status }
    const { error } = await supabase
      .from('inquiries')
      .update(patch)
      .eq('id', id)

    if (!error) {
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: status as Inquiry['status'], ...(pickupInviteSentAt ? { pickup_invite_sent_at: pickupInviteSentAt } : {}) } : i))
    } else {
      toast.error('Failed to update status')
    }
  }

  const updateCategory = async (id: number, category: string) => {
    const { error } = await supabase
      .from('inquiries')
      .update({ category: category || null })
      .eq('id', id)

    if (!error) {
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, category } : i))
    } else {
      toast.error('Failed to update category')
    }
  }

  const archiveInquiry = async (id: number) => {
    const { error } = await supabase
      .from('inquiries')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      toast.success('Inquiry archived')
      fetchInquiries()
    } else {
      toast.error('Failed to archive inquiry')
    }
  }

  const restoreInquiry = async (id: number) => {
    const { error } = await supabase
      .from('inquiries')
      .update({ archived_at: null })
      .eq('id', id)

    if (!error) {
      toast.success('Inquiry restored')
      fetchInquiries()
    } else {
      toast.error('Failed to restore inquiry')
    }
  }

  const hardDeleteInquiry = async (id: number) => {
    if (!confirm('Permanently delete this inquiry? This cannot be undone.')) return

    const { error } = await supabase
      .from('inquiries')
      .delete()
      .eq('id', id)

    if (!error) {
      toast.success('Inquiry permanently deleted')
      fetchInquiries()
    } else {
      toast.error('Failed to delete inquiry')
    }
  }

  const fetchComments = async (id: number) => {
    const { data } = await supabase
      .from('inquiry_comments')
      .select('*')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: true })

    if (data) {
      setComments(prev => ({ ...prev, [id]: data }))
    }
  }

  const addComment = async (id: number, text: string) => {
    if (!text.trim()) return

    const { error } = await supabase
      .from('inquiry_comments')
      .insert({ inquiry_id: id, comment: text.trim() })

    if (!error) {
      setNewCommentText('')
      await fetchComments(id)
    } else {
      toast.error('Failed to add note')
    }
  }

  const toggleExpand = async (id: number) => {
    if (expandedInquiry === id) {
      setExpandedInquiry(null)
    } else {
      setExpandedInquiry(id)
      if (!comments[id]) {
        await fetchComments(id)
      }
    }
  }

  // Toggle moderation
  const toggleModeration = async () => {
    const newValue = !moderationEnabled

    const { error } = await supabase
      .from('settings')
      .update({ value: newValue.toString() })
      .eq('key', 'moderation_enabled')

    if (!error) {
      setModerationEnabled(newValue)
      toast.success(`Moderation ${newValue ? 'enabled' : 'disabled'}`)
    } else {
      toast.error('Failed to update settings')
    }
  }

  const toggleAutoApproveAllEdits = async () => {
    const newValue = !autoApproveAllEdits
    const { error } = await supabase
      .from('settings')
      .update({ value: newValue.toString() })
      .eq('key', 'auto_approve_all_edits')
    if (!error) {
      setAutoApproveAllEdits(newValue)
      toast.success(`Edit auto-approve ${newValue ? 'on: all edits go live immediately' : 'off: edits queue for review'}`)
    } else {
      toast.error('Failed to update settings')
    }
  }

  const toggleHouseAutoApprove = async (qrCodeId: string, current: boolean) => {
    const { error } = await supabase
      .from('houses')
      .update({ auto_approve_edits: !current })
      .eq('qr_code_id', qrCodeId)
    if (!error) {
      toast.success(!current ? 'Auto-approve on for this house' : 'Auto-approve off. Edits will queue')
      fetchHouses()
    } else {
      toast.error('Failed to update')
    }
  }

  // Approve house, but never publish a nameless one: the public map
  // and /v pages fall back to the raw code as a display name.
  const approveHouse = async (qrCodeId: string) => {
    const target = houses.find((h) => h.qr_code_id === qrCodeId)
    if (!target?.slug) {
      toast.error("Give it a name first. It can't publish without one")
      return
    }
    const { error } = await supabase
      .from('houses')
      .update({ status: 'live', updated_at: new Date().toISOString() })
      .eq('qr_code_id', qrCodeId)

    if (!error) {
      toast.success('House approved!')
      fetchHouses()
    } else {
      toast.error('Failed to approve house')
    }
  }

  // Retire house: opens the reason modal
  const rejectHouse = (qrCodeId: string) => {
    setRetireReason('behaviour')
    setRetireTarget(qrCodeId)
  }

  const confirmRetireHouse = async () => {
    if (!retireTarget) return
    const qrCodeId = retireTarget
    setRetireTarget(null)

    // Retire the qr_codes row (never hard-delete; prevents ID reuse)
    const { error: retireErr } = await supabase
      .from('qr_codes')
      .update({ retired_at: new Date().toISOString(), retired_reason: retireReason })
      .eq('id', qrCodeId)

    if (retireErr) { toast.error('Failed to retire house'); return }

    // Remove the houses row so it no longer appears on the map
    await supabase.from('houses').delete().eq('qr_code_id', qrCodeId)

    toast.success('House retired. The URL now returns a removal notice.')
    fetchHouses()
    fetchQRCodes()
  }

  const sendWelcomeEmail = async (inquiry: Inquiry, force = false) => {
    if (force) {
      const sentOn = inquiry.welcome_sent_at
        ? new Date(inquiry.welcome_sent_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'previously'
      if (!confirm(`Already sent on ${sentOn}. Send again to ${inquiry.email}?`)) return
    } else {
      if (!confirm(`Send welcome email to ${inquiry.name} (${inquiry.email}) and create their birdhouse (Invited, hidden until they fill it in)?`)) return
    }
    setSendingWelcome(inquiry.id)
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/send-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error === 'welcome_already_sent'
          ? 'Welcome email already sent.'
          : typeof data.error === 'string' && data.error.startsWith('email_send_failed')
            ? `Email failed to send. The birdhouse exists, use Resend to retry. (${data.error.replace('email_send_failed: ', '')})`
            : `Failed: ${data.error}`
        toast.error(msg)
        return
      }
      toast.success(force ? `Resent to ${inquiry.email}` : `Welcome email sent! House ID: ${data.qrCodeId}`)
      fetchInquiries()
      fetchHouses()
      fetchQRCodes()
    } catch {
      toast.error('Network error sending welcome email')
    } finally {
      setSendingWelcome(null)
    }
  }

  const assignHouse = async (inquiryId: number, qrCodeId: string | null) => {
    setAssigningHouse(inquiryId)
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiryId}/assign-house`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_id: qrCodeId }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(`Failed: ${data.error}`)
        return
      }
      toast.success(qrCodeId ? 'House linked to inquiry.' : 'House unlinked.')
      fetchInquiries()
    } catch {
      toast.error('Network error assigning house')
    } finally {
      setAssigningHouse(null)
    }
  }

  const addScript = (inquiryId: number) => {
    const choice = scriptChoice[inquiryId]
    if (choice === undefined || choice === '') return
    const script = replyScripts.find(s => s.id === choice)
    if (!script) return
    setReplyTexts(prev => {
      const existing = (prev[inquiryId] ?? '').trim()
      return { ...prev, [inquiryId]: existing ? `${existing}\n\n${script.body}` : script.body }
    })
    setScriptChoice(prev => ({ ...prev, [inquiryId]: '' }))
  }

  const sendReply = async (inquiry: Inquiry) => {
    const message = (replyTexts[inquiry.id] ?? '').trim()
    if (!message) return
    setSendingReply(inquiry.id)
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(`Failed: ${data.error}`); return }
      toast.success('Reply sent!')
      setReplyTexts(prev => ({ ...prev, [inquiry.id]: '' }))
      await fetchComments(inquiry.id)
      fetchInquiries()
    } catch {
      toast.error('Network error sending reply')
    } finally {
      setSendingReply(null)
    }
  }

  const statusBadgeClass = (status: string) =>
    INQUIRY_STATUSES.find(s => s.value === status)?.badgeClass ?? 'bg-gray-100 text-gray-600'

  const statusLabel = (status: string) =>
    INQUIRY_STATUSES.find(s => s.value === status)?.label ?? status

  // The contact form's message field is optional; an empty message renders
  // as a placeholder rather than a blank box.
  const inquiryMessageOrPlaceholder = (message: string) =>
    message.trim() ? message : 'No message included with this request.'

  // Pending request buckets, split by type.
  const newRequests = useMemo(
    () => requests.filter(r => r.status === 'pending' && r.type === 'new_profile'),
    [requests],
  )
  const editRequests = useMemo(
    () => requests.filter(r => r.status === 'pending' && r.type === 'edit'),
    [requests],
  )
  const suspendedHouses = houses.filter(h => h.status === 'suspended' && !h.archived_at)
  const archivedHouses = houses.filter(h => h.archived_at)
  // Houses published live without admin review; a house dropped/
  // suspended before ack just falls out of this list on its own.
  const unreviewedPublishHouses = houses.filter(h => h.unreviewed_publish_at && h.status === 'live' && !h.archived_at)

  const ackUnreviewedPublish = async (qrCodeId: string) => {
    setAckingUnreviewed(qrCodeId)
    try {
      const { error } = await supabase
        .from('houses')
        .update({ unreviewed_publish_at: null, unreviewed_publish_source: null })
        .eq('qr_code_id', qrCodeId)
      if (!error) {
        await fetchHouses()
      } else {
        toast.error('Failed to update')
      }
    } finally {
      setAckingUnreviewed(null)
    }
  }
  // Stat cards count real houses only; archived (deleted) ones are ghosts.
  const activeHouses = houses.filter(h => !h.archived_at)
  // Total Houses also skips invited placeholders, empty shells until claimed.
  const countedHouses = activeHouses.filter(h => h.status !== 'invited')

  // Change tab AND reflect it in the URL so tabs are linkable and the browser
  // Back/Forward buttons move between them.
  const selectTab = (id: AdminTab) => {
    setTab(id)
    if (typeof window !== 'undefined') window.history.pushState(null, '', `?tab=${id}`)
  }

  // Pick the default tab once, after the first data load: a ?tab= in the URL wins;
  // otherwise land on the first bucket that needs the admin's attention, else Live.
  useEffect(() => {
    if (tabInitialized || loading || !user) return
    const urlTab = tabFromUrl()
    if (urlTab) setTab(urlTab)
    else if (newRequests.length > 0) setTab('new')
    else if (reviewHouses.length > 0) setTab('review')
    else if (editRequests.length > 0) setTab('edits')
    else setTab('live')
    setTabInitialized(true)
  }, [tabInitialized, loading, user, newRequests.length, reviewHouses.length, editRequests.length])

  // Keep the visible tab in sync when the user hits Back/Forward.
  useEffect(() => {
    const onPop = () => { const t = tabFromUrl(); if (t) setTab(t) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Tab order follows the lifecycle: inbound asks, pipeline, published, archive.
  // Zero-count tabs auto-hide except the ones marked alwaysVisible and whichever
  // tab is currently active (protects a ?tab= deep link from disappearing).
  const TABS = ([
    { id: 'new', label: 'New requests', count: newRequests.length, alert: true, alwaysVisible: true },
    { id: 'invited', label: 'Invited', count: invitedHouses.length },
    { id: 'review', label: 'Ready for Review', count: reviewHouses.length, alert: true },
    { id: 'edits', label: 'Edits', count: editRequests.length, alert: true },
    { id: 'live', label: 'Live', count: liveHouses.length, alwaysVisible: true },
    { id: 'suspended', label: 'Suspended', count: suspendedHouses.length },
    { id: 'deleted', label: 'Deleted', count: archivedHouses.length },
    { id: 'inquiries', label: 'Inquiries', count: inquiries.length, alwaysVisible: true },
    { id: 'scripts', label: 'Email scripts', count: replyScripts.length, alwaysVisible: true },
  ] as { id: AdminTab; label: string; count: number; alert?: boolean; alwaysVisible?: boolean }[])
    .filter(t => t.count > 0 || t.alwaysVisible || t.id === tab)

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              providers={[]}
              onlyThirdPartyProviders={false}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-3 md:p-6">
      <div className="max-w-[1440px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Link href="/admin/quick-add" data-testid="quick-add-link">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white">Quick add</Button>
            </Link>
            <Link href="/map">
              <Button variant="outline">View Site</Button>
            </Link>
            {unreviewedPublishHouses.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  data-testid="unreviewed-publish-badge"
                  onClick={() => setUnreviewedDropdownOpen(v => !v)}
                  className="relative border-amber-300 text-amber-800 hover:bg-amber-50"
                  title="Birdhouses that went live without your review"
                >
                  <Bell className="h-4 w-4" />
                  {unreviewedPublishHouses.length}
                </Button>
                {unreviewedDropdownOpen && (
                  <div
                    data-testid="unreviewed-publish-dropdown"
                    className="absolute end-0 z-10 mt-2 w-80 rounded-lg border border-amber-200 bg-white p-2 shadow-lg"
                  >
                    <p className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Went live without your review
                    </p>
                    {unreviewedPublishHouses.map(h => (
                      <div key={h.qr_code_id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-amber-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">{h.artist_name || h.slug || h.qr_code_id}</p>
                          <p className="text-xs text-gray-400">{(h.unreviewed_publish_source && UNREVIEWED_SOURCE_LABEL[h.unreviewed_publish_source]) || 'Published without review'}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ackingUnreviewed === h.qr_code_id}
                          data-testid={`unreviewed-ack-${h.qr_code_id}`}
                          onClick={() => ackUnreviewedPublish(h.qr_code_id)}
                          className="shrink-0"
                        >
                          Got it
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button onClick={() => supabase.auth.signOut()}>Sign Out</Button>
          </div>
        </div>

        {healthError && (
          <div className="mb-8 rounded-lg border border-red-400 bg-red-50 p-4 text-sm text-red-800" data-testid="health-banner">
            <strong>&#9888;&#65039; Admin writes may be broken.</strong> {healthError}
          </div>
        )}

        {/* Tab bar: one bucket visible at a time */}
        <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Admin sections">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                data-testid={`admin-tab-${t.id}`}
                onClick={() => selectTab(t.id)}
                className={`relative inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`rounded-full px-1.5 text-xs font-semibold ${
                    active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.count}
                </span>
                {t.alert && t.count > 0 && !active && (
                  <span className="absolute -top-1 -end-1 h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden />
                )}
              </button>
            )
          })}
        </div>

        {/* Street Dots isn't a same-page tab; it navigates away, so it lives
            outside the tablist (mobile-only; desktop reaches it via the stats grid). */}
        <div className="mb-8 md:hidden">
          <Link
            href="/admin/markers"
            data-testid="street-dots-pill"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-amber-300 hover:bg-amber-50"
          >
            Street Dots <span className="rounded-full bg-gray-100 px-1.5 text-xs font-semibold text-gray-600">{streetDotCount ?? '-'}</span>
          </Link>
        </div>

        {/* Stats: hidden on mobile; navigation there happens via the tab pills above */}
        <div id="admin-stats-grid" className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {liveHouses.length > 0 && (
            <StatLinkCard
              testId="live-houses-card"
              onSelect={() => selectTab('live')}
              label="Live Houses"
              count={liveHouses.length}
              colorClass="text-green-600"
            />
          )}
          {invitedHouses.length > 0 && (
            <StatLinkCard
              testId="invited-card"
              onSelect={() => selectTab('invited')}
              label="Invited"
              count={invitedHouses.length}
              colorClass="text-slate-600"
            />
          )}
          {reviewHouses.length > 0 && (
            <StatLinkCard
              testId="review-card"
              onSelect={() => selectTab('review')}
              label="Ready for Review"
              count={reviewHouses.length}
              colorClass="text-yellow-600"
            />
          )}
          <Card className="h-full bg-gray-50/70 border-dashed shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Houses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-500" data-testid="total-houses-count">{countedHouses.length}</p>
            </CardContent>
          </Card>
          <Card className="h-full bg-gray-50/70 border-dashed shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-500">
                {activeHouses.reduce((sum, h) => sum + (h.house_images?.length ?? 0), 0)}
              </p>
            </CardContent>
          </Card>
          {inquiries.length > 0 && (
            <StatLinkCard
              testId="total-inquiries-card"
              onSelect={() => selectTab('inquiries')}
              label="Total Inquiries"
              count={inquiries.length}
              colorClass="text-orange-600"
            />
          )}
          <StatLinkCard
            testId="email-scripts-card"
            onSelect={() => selectTab('scripts')}
            label="Email scripts"
            count={replyScripts.length}
            colorClass="text-teal-600"
          />
          <Link href="/admin/markers" className="block">
            <Card className="h-full hover:border-amber-400 transition-colors" data-testid="street-dots-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Street Dots</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-600">{streetDotCount ?? '-'}</p>
                <p className="text-xs text-gray-400 mt-1">active, manage</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Require approval for new profiles</p>
                <p className="text-sm text-gray-600">
                  When on, new profile requests queue for your review before a house is created.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={moderationEnabled}
                  onChange={toggleModeration}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="border-t pt-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-approve all edits</p>
                <p className="text-sm text-gray-600">
                  When on, every steward&apos;s edit goes live immediately: no review queue. Overrides per-house settings.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoApproveAllEdits}
                  onChange={toggleAutoApproveAllEdits}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* New requests bucket */}
        {tab === 'new' && (
          <div className="space-y-4" data-testid="bucket-new">
            <div>
              <h2 className="text-xl font-semibold">New requests ({newRequests.length})</h2>
              <p className="text-sm text-gray-500">People asking for a birdhouse: approve to send a welcome link, or decline.</p>
            </div>
            {newRequests.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-gray-500">No new profile requests waiting.</CardContent></Card>
            ) : (
              newRequests.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  acting={actingRequest === r.id}
                  messageOpen={messageFor === r.id}
                  messageText={messageFor === r.id ? messageText : ''}
                  onMessageTextChange={setMessageText}
                  onOpenMessage={() => { setMessageFor(r.id); setMessageText(r.admin_note ?? '') }}
                  onCloseMessage={() => { setMessageFor(null); setMessageText('') }}
                  onApprove={() => runRequestAction(r.id, 'approve')}
                  onDenyClick={() => { setDenyFor(r.id); setDenyNote('') }}
                  denyOpen={denyFor === r.id}
                  denyNote={denyFor === r.id ? denyNote : ''}
                  onDenyNoteChange={setDenyNote}
                  onConfirmDeny={() => {
                    if (!denyNote.trim()) return
                    runRequestAction(r.id, 'deny', undefined, denyNote.trim())
                    setDenyFor(null); setDenyNote('')
                  }}
                  onCancelDeny={() => { setDenyFor(null); setDenyNote('') }}
                  onDismiss={() => runRequestAction(r.id, 'dismiss')}
                  onSaveMessage={() => runRequestAction(r.id, 'message', messageText)}
                />
              ))
            )}
          </div>
        )}

        {/* Edits bucket: before/after diff against the target house */}
        {tab === 'edits' && (
          <div className="space-y-4" data-testid="bucket-edits">
            <div>
              <h2 className="text-xl font-semibold">Edits ({editRequests.length})</h2>
              <p className="text-sm text-gray-500">Steward changes waiting for your review before they go live.</p>
            </div>
            {editRequests.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-gray-500">No edit submissions waiting.</CardContent></Card>
            ) : (
              editRequests.map((r) => {
                const targetHouse = houses.find(h => h.qr_code_id === r.target_qr_code_id)
                const diff = targetHouse ? diffEdit(targetHouse, (r.payload || {}) as Record<string, unknown>) : null
                return (
                  <RequestCard
                    key={r.id}
                    request={r}
                    diff={diff}
                    targetHouse={targetHouse}
                    acting={actingRequest === r.id}
                    messageOpen={messageFor === r.id}
                    messageText={messageFor === r.id ? messageText : ''}
                    onMessageTextChange={setMessageText}
                    onOpenMessage={() => { setMessageFor(r.id); setMessageText(r.admin_note ?? '') }}
                    onCloseMessage={() => { setMessageFor(null); setMessageText('') }}
                    onApprove={() => runRequestAction(r.id, 'approve')}
                    onDenyClick={() => { setDenyFor(r.id); setDenyNote('') }}
                    denyOpen={denyFor === r.id}
                    denyNote={denyFor === r.id ? denyNote : ''}
                    onDenyNoteChange={setDenyNote}
                    onConfirmDeny={() => {
                      if (!denyNote.trim()) return
                      runRequestAction(r.id, 'deny', undefined, denyNote.trim())
                      setDenyFor(null); setDenyNote('')
                    }}
                    onCancelDeny={() => { setDenyFor(null); setDenyNote('') }}
                    onDismiss={() => runRequestAction(r.id, 'dismiss')}
                    onSaveMessage={() => runRequestAction(r.id, 'message', messageText)}
                  />
                )
              })
            )}
          </div>
        )}

        {/* Invited bucket: link sent, steward hasn't filled it in yet (status='invited') */}
        {tab === 'invited' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Invited ({invitedHouses.length})</CardTitle>
              <p className="text-sm text-gray-500">Welcome link sent. Waiting on the steward to fill in their page. Not public yet.</p>
            </CardHeader>
            <CardContent>
              {invitedHouses.length === 0 ? (
                <p className="py-10 text-center text-gray-500">No invited birdhouses waiting.</p>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-start p-2">Bird House</th>
                      <th className="text-start p-2">Sent</th>
                      <th className="text-start p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitedHouses.map((house) => (
                      <tr key={house.qr_code_id} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{house.artist_name || house.slug || house.qr_code_id}</td>
                        <td className="p-2 text-sm text-gray-500">{new Date(house.claimed_at).toLocaleDateString()}</td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Link href={`/admin/houses/${house.qr_code_id}`}><Button size="sm" variant="outline">Edit</Button></Link>
                            <Button size="icon" variant="ghost" title="Copy edit URL" onClick={() => copyEditUrl(house)}>
                              {copiedKey === `edit-${house.qr_code_id}` ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ready for Review bucket: steward submitted first version (status='review') */}
        {tab === 'review' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Ready for Review ({reviewHouses.length})</CardTitle>
              <p className="text-sm text-gray-500">First version submitted: approve to publish, or reject.</p>
            </CardHeader>
            <CardContent>
              {reviewHouses.length === 0 ? (
                <p className="py-10 text-center text-gray-500">Nothing waiting for review.</p>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-start p-2">Bird House</th>
                      <th className="text-start p-2">Claimed</th>
                      <th className="text-center p-2">Photos</th>
                      <th className="text-start p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewHouses.map((house) => (
                      <tr key={house.qr_code_id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <Link href={`/v/${house.slug ?? house.qr_code_id}`} className="font-medium text-amber-700 hover:underline">
                            {house.slug || house.qr_code_id}
                          </Link>
                        </td>
                        <td className="p-2 text-sm text-gray-500">{new Date(house.claimed_at).toLocaleDateString()}</td>
                        <td className="p-2 text-center text-sm">
                          {(house.house_images?.length ?? 0) > 0
                            ? <span className="text-green-700 font-medium">{house.house_images!.length}</span>
                            : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Link href={`/admin/houses/${house.qr_code_id}`}><Button size="sm" variant="outline">Edit</Button></Link>
                            <Button size="icon" variant="ghost" title="Copy edit URL" onClick={() => copyEditUrl(house)}>
                              {copiedKey === `edit-${house.qr_code_id}` ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" onClick={() => approveHouse(house.qr_code_id)}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => rejectHouse(house.qr_code_id)}>Reject</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Live Houses */}
        {tab === 'live' && (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Live Houses ({liveHouses.length})</CardTitle>
              <p className="text-sm text-gray-500">Published profiles: visible on the map and public pages.</p>
            </div>
            <Link href="/admin/houses/new">
              <Button>+ Create New House</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-start p-2">Bird House</th>
                    <th className="text-center p-2">Photos</th>
                    <th className="text-center p-2">Auto-approve</th>
                    <th className="text-start p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {liveHouses.map((house) => (
                    <tr key={house.qr_code_id} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/v/${house.slug ?? house.qr_code_id}`} className="font-medium text-amber-700 hover:underline">
                            {house.slug || house.qr_code_id}
                          </Link>
                          {house.pending_edit_id && (
                            <button
                              type="button"
                              onClick={() => selectTab('edits')}
                              className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium"
                              title="A draft is waiting for review"
                              data-testid={`draft-pending-pill-${house.qr_code_id}`}
                            >
                              Draft pending
                            </button>
                          )}
                          {house.unreviewed_publish_at && (
                            <button
                              type="button"
                              disabled={ackingUnreviewed === house.qr_code_id}
                              onClick={() => ackUnreviewedPublish(house.qr_code_id)}
                              className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium"
                              title={`${(house.unreviewed_publish_source && UNREVIEWED_SOURCE_LABEL[house.unreviewed_publish_source]) || 'Published without review'}: click to acknowledge`}
                              data-testid={`unreviewed-pill-${house.qr_code_id}`}
                            >
                              &#128276; Auto-published: Got it
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center text-sm">
                        {(house.house_images?.length ?? 0) > 0
                          ? <span className="text-green-700 font-medium">{house.house_images!.length}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="p-2 text-center">
                        <label className="relative inline-flex items-center cursor-pointer" title={house.auto_approve_edits ? 'Edits go live immediately' : 'Edits queue for review'}>
                          <input
                            type="checkbox"
                            checked={house.auto_approve_edits}
                            onChange={() => toggleHouseAutoApprove(house.qr_code_id, house.auto_approve_edits)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Link href={`/admin/houses/${house.qr_code_id}`}><Button size="sm">Edit</Button></Link>
                          <Button size="icon" variant="ghost" title="Copy edit URL" onClick={() => copyEditUrl(house)}>
                            {copiedKey === `edit-${house.qr_code_id}` ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {liveHouses.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No live houses yet. Waiting for stewards to claim QR codes.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Suspended Houses */}
        {tab === 'suspended' && (
          suspendedHouses.length > 0 ? (
          <Card className="mb-8 border-red-200">
            <CardHeader>
              <CardTitle>Suspended ({suspendedHouses.length})</CardTitle>
              <p className="text-sm text-gray-500">Hidden from the public for moderation. Restore to republish, or delete.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-start p-2">Bird House</th>
                      <th className="text-center p-2">Photos</th>
                      <th className="text-start p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suspendedHouses.map((house) => (
                      <tr key={house.qr_code_id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <span className="font-medium text-gray-500">{house.slug || house.qr_code_id}</span>
                        </td>
                        <td className="p-2 text-center text-sm">
                          {(house.house_images?.length ?? 0) > 0
                            ? <span className="text-gray-600 font-medium">{house.house_images!.length}</span>
                            : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Link href={`/admin/houses/${house.qr_code_id}`}><Button size="sm">Edit</Button></Link>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-700 hover:bg-red-50"
                              onClick={() => archiveHouse(house.qr_code_id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          ) : (
            <Card className="mb-8"><CardContent className="py-10 text-center text-gray-500">No suspended profiles.</CardContent></Card>
          )
        )}

        {/* Archived (soft-deleted) Houses: the "Deleted" tab */}
        {tab === 'deleted' && (
          archivedHouses.length > 0 ? (
          <Card className="mb-8 border-gray-300">
            <CardHeader>
              <CardTitle>Deleted ({houses.filter(h => h.archived_at).length})</CardTitle>
              <p className="text-sm text-gray-500">Removed from the site but kept here. Restore anytime.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-start p-2">Bird House</th>
                      <th className="text-center p-2">Photos</th>
                      <th className="text-start p-2">Actions</th>
                      <th className="text-end p-2">Perm delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {houses.filter(h => h.archived_at).map((house) => (
                      <tr key={house.qr_code_id} className="border-b hover:bg-gray-50" data-testid={`archived-house-${house.qr_code_id}`}>
                        <td className="p-2">
                          <span className="font-medium text-gray-500">{house.slug || house.qr_code_id}</span>
                        </td>
                        <td className="p-2 text-center text-sm">
                          {(house.house_images?.length ?? 0) > 0
                            ? <span className="text-gray-600 font-medium">{house.house_images!.length}</span>
                            : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => restoreHouse(house.qr_code_id)}>Restore</Button>
                            <Link href={`/admin/houses/${house.qr_code_id}`}><Button size="sm" variant="outline">Edit</Button></Link>
                          </div>
                        </td>
                        <td className="p-2 text-end">
                          <Button
                            size="sm"
                            variant="destructive"
                            data-testid={`perm-delete-${house.qr_code_id}`}
                            onClick={() => setPermDeleteTarget(house)}
                          >
                            Delete forever
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          ) : (
            <Card className="mb-8"><CardContent className="py-10 text-center text-gray-500">No deleted profiles.</CardContent></Card>
          )
        )}

        {/* Inquiries */}
        {tab === 'inquiries' && (
        <Card>
          <CardHeader className="p-4">
            <CardTitle>Inquiries ({inquiries.length})</CardTitle>
            <p className="text-sm text-gray-500">Messages sent through the site&apos;s contact form.</p>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap">
              <select
                data-testid="status-filter"
                className="border rounded px-3 py-1.5 text-sm"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                {INQUIRY_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                data-testid="category-filter"
                className="border rounded px-3 py-1.5 text-sm"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="volunteer">Volunteer</option>
                <option value="donor">Donor</option>
                <option value="host">Host</option>
                <option value="artist">Artist</option>
                <option value="creative">Creative</option>
                <option value="birdhouse">Birdhouse</option>
                <option value="perch">Perch</option>
                <option value="partner">Partner</option>
                <option value="media">Media</option>
                <option value="general">General</option>
                <option value="bug">Bug</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-4">
              {inquiries
                .filter(i => statusFilter === 'all' || i.status === statusFilter)
                .filter(i => categoryFilter === 'all' || i.category === categoryFilter)
                .map((inquiry) => (
                <div
                  key={inquiry.id}
                  className={`rounded-xl border bg-white shadow-sm transition-shadow ${
                    expandedInquiry === inquiry.id
                      ? 'border-amber-300 ring-1 ring-amber-300 shadow-md'
                      : 'border-gray-200 hover:border-amber-200'
                  }`}
                >
                  {/* Card header: click anywhere (except the controls) to open/close */}
                  <div
                    className="p-4 cursor-pointer rounded-xl hover:bg-amber-50/40"
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedInquiry === inquiry.id}
                    onClick={() => toggleExpand(inquiry.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(inquiry.id) } }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <p className="font-semibold">{inquiry.name}</p>
                        <select
                          data-testid={`status-select-${inquiry.id}`}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer ${statusBadgeClass(inquiry.status)}`}
                          value={inquiry.status}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateStatus(inquiry.id, e.target.value)}
                        >
                          {INQUIRY_STATUSES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <select
                          data-testid={`category-select-${inquiry.id}`}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border-0 cursor-pointer"
                          value={inquiry.category || ''}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateCategory(inquiry.id, e.target.value)}
                        >
                          <option value="">Uncategorized</option>
                          <option value="volunteer">Volunteer</option>
                          <option value="donor">Donor</option>
                          <option value="host">Host</option>
                          <option value="artist">Artist</option>
                          <option value="creative">Creative</option>
                          <option value="birdhouse">Birdhouse</option>
                          <option value="perch">Perch</option>
                          <option value="partner">Partner</option>
                          <option value="media">Media</option>
                          <option value="general">General</option>
                          <option value="bug">Bug</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {!inquiry.welcome_sent_at && (() => {
                          const ready = isReadyToWelcome(inquiry)
                          return (
                            <div className="relative">
                              {ready && (
                                <span
                                  data-testid={`welcome-ready-${inquiry.id}`}
                                  className="absolute -top-1 -end-1 h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"
                                  title="3+ days since the pickup invite: ready to welcome"
                                  aria-hidden
                                />
                              )}
                              <Button
                                size="sm"
                                variant={ready ? 'default' : 'outline'}
                                className={ready ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
                                disabled={sendingWelcome === inquiry.id}
                                onClick={(e) => { e.stopPropagation(); sendWelcomeEmail(inquiry) }}
                                title={ready
                                  ? '3+ days since the pickup invite: create their house and send the welcome email'
                                  : 'Create a suspended house and send welcome email'}
                              >
                                {sendingWelcome === inquiry.id ? '...' : 'Welcome'}
                              </Button>
                            </div>
                          )
                        })()}
                        {inquiry.welcome_sent_at && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-green-700 font-medium" title={`Sent ${new Date(inquiry.welcome_sent_at).toLocaleString()}`}>
                              &#10003; Welcomed {new Date(inquiry.welcome_sent_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={sendingWelcome === inquiry.id}
                              onClick={(e) => { e.stopPropagation(); sendWelcomeEmail(inquiry, true) }}
                              title="Resend welcome email (you'll be asked to confirm)"
                              className="text-xs text-gray-400 hover:text-amber-700 px-1 h-auto py-0.5"
                            >
                              {sendingWelcome === inquiry.id ? '...' : 'Resend'}
                            </Button>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-500"
                          data-testid={`archive-btn-${inquiry.id}`}
                          onClick={(e) => { e.stopPropagation(); archiveInquiry(inquiry.id) }}
                        >
                          Archive
                        </Button>
                        <span
                          data-testid={`expand-btn-${inquiry.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500"
                          aria-hidden
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${expandedInquiry === inquiry.id ? 'rotate-180' : ''}`}
                          />
                        </span>
                      </div>
                    </div>

                    {/* Full width below the name and buttons row. */}
                    <p className="text-sm text-gray-600 mt-0.5">
                      {inquiry.email}
                      <span className="text-gray-400"> | {new Date(inquiry.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </p>
                    {expandedInquiry !== inquiry.id && (
                      <p className={`mt-1 text-sm truncate ${inquiry.message.trim() ? 'text-gray-500' : 'text-gray-400 italic'}`}>
                        {inquiryMessageOrPlaceholder(inquiry.message)}
                      </p>
                    )}
                    {/* Assigned house pill */}
                    {inquiry.assigned_qr_code_id && (() => {
                      const editCode = qrCodes.find(q => q.id === inquiry.assigned_qr_code_id)?.edit_code
                      return (
                        <>
                          <p className="text-xs text-green-700 mt-1 font-medium">
                            Linked house: <a href={`/h/${inquiry.assigned_qr_code_id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="underline hover:text-green-900">{inquiry.assigned_qr_code_id}</a>
                          </p>
                          {editCode && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Edit code: <a href={`/h/${inquiry.assigned_qr_code_id}?edit=${editCode}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="underline font-mono hover:text-gray-700">{editCode}</a>
                            </p>
                          )}
                        </>
                      )
                    })()}
                  </div>

                  {/* Expanded detail: clearly separated, labelled sections */}
                  {expandedInquiry === inquiry.id && (
                    <div className="border-t border-amber-200 bg-amber-50/40 p-3 space-y-3" data-testid={`notes-section-${inquiry.id}`}>
                      {/* Message + Link-to-house share a row on desktop: same kind of
                          compact metadata, no reason to stack them full-width. */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            <MessageSquare className="h-3.5 w-3.5" /> Message
                          </div>
                          <p className={`max-h-20 overflow-y-auto whitespace-pre-wrap text-sm ${inquiry.message.trim() ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                            {inquiryMessageOrPlaceholder(inquiry.message)}
                          </p>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            <Link2 className="h-3.5 w-3.5" /> Link to existing house
                          </label>
                          <select
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            value={inquiry.assigned_qr_code_id ?? ''}
                            disabled={assigningHouse === inquiry.id}
                            onChange={e => assignHouse(inquiry.id, e.target.value || null)}
                          >
                            <option value="">(unlinked)</option>
                            {houses.map(h => (
                              <option key={h.qr_code_id} value={h.qr_code_id}>
                                {h.slug || h.qr_code_id} ({h.status})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Thread and reply composer share one panel. */}
                      <div className="rounded-lg border border-amber-200 bg-white p-3 space-y-3">
                        <div>
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            <MessageSquare className="h-3.5 w-3.5" /> Conversation ({(comments[inquiry.id] || []).length})
                          </div>
                          <div className="space-y-2">
                            {(comments[inquiry.id] || []).map(c => (
                              c.type === 'reply' ? (
                                <div key={c.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                                  <div className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-amber-700">
                                    <Mail className="h-3 w-3" /> Sent to {inquiry.email}
                                    <span className="font-normal text-gray-400"> | {new Date(c.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <p className="whitespace-pre-wrap text-gray-800">{c.comment}</p>
                                </div>
                              ) : (
                                <div key={c.id} className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm">
                                  <div className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-yellow-700">
                                    <Lock className="h-3 w-3" /> Private note
                                    <span className="font-normal text-gray-400"> | {new Date(c.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <p className="whitespace-pre-wrap text-gray-800">{c.comment}</p>
                                </div>
                              )
                            ))}
                            {(comments[inquiry.id] || []).length === 0 && (
                              <p className="text-xs text-gray-400">No messages yet.</p>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-gray-100 pt-3">
                          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                            <Mail className="h-3.5 w-3.5" /> Reply by email
                          </label>
                          <p className="mb-2 text-xs text-gray-500">This sends an email to {inquiry.name} ({inquiry.email}).</p>
                          {replyScripts.length > 0 && (
                            <div className="flex gap-2 mb-2">
                              <select
                                value={scriptChoice[inquiry.id] ?? ''}
                                onChange={e => setScriptChoice(prev => ({ ...prev, [inquiry.id]: e.target.value }))}
                                className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700"
                              >
                                <option value="">Insert a scripted reply...</option>
                                {replyScripts.map(s => (
                                  <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={(scriptChoice[inquiry.id] ?? '') === ''}
                                onClick={() => addScript(inquiry.id)}
                              >
                                Add
                              </Button>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Textarea
                              rows={3}
                              placeholder={`Hi ${inquiry.name},\n\nThanks for reaching out...`}
                              value={replyTexts[inquiry.id] ?? ''}
                              onChange={e => setReplyTexts(prev => ({ ...prev, [inquiry.id]: e.target.value }))}
                              className="text-sm"
                            />
                            <Button
                              size="sm"
                              disabled={sendingReply === inquiry.id || !(replyTexts[inquiry.id] ?? '').trim()}
                              onClick={() => sendReply(inquiry)}
                              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                            >
                              {sendingReply === inquiry.id ? '...' : 'Send'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Internal note stays in its own box so a private note is
                          never sent as an email. Collapsed by default. */}
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50/60 p-3">
                        {noteComposerOpen[inquiry.id] ? (
                          <>
                            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-yellow-700">
                              <Lock className="h-3.5 w-3.5" /> Add internal note
                            </label>
                            <p className="mb-2 text-xs text-gray-500">Private, not emailed to anyone.</p>
                            <div className="flex gap-2">
                              <Textarea
                                rows={2}
                                placeholder="Add an internal note..."
                                value={newCommentText}
                                onChange={e => setNewCommentText(e.target.value)}
                                data-testid={`comment-input-${inquiry.id}`}
                                className="text-sm bg-white"
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    addComment(inquiry.id, newCommentText)
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                                data-testid={`add-comment-btn-${inquiry.id}`}
                                onClick={() => addComment(inquiry.id, newCommentText)}
                              >
                                Add note
                              </Button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            data-testid={`open-note-composer-${inquiry.id}`}
                            onClick={() => setNoteComposerOpen(prev => ({ ...prev, [inquiry.id]: true }))}
                            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-yellow-700 hover:text-yellow-900"
                          >
                            <Lock className="h-3.5 w-3.5" /> + Add internal note
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {inquiries.filter(i =>
                (statusFilter === 'all' || i.status === statusFilter) &&
                (categoryFilter === 'all' || i.category === categoryFilter)
              ).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {inquiries.length === 0 ? 'No inquiries yet.' : 'No inquiries match the selected filters.'}
                </div>
              )}
            </div>

            {/* Archived section */}
            <div className="mt-6 border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                data-testid="toggle-archived"
                onClick={() => setShowArchived(v => !v)}
                className="text-gray-500"
              >
                {showArchived ? 'Hide' : 'Show'} Archived ({archivedInquiries.length})
              </Button>

              {showArchived && (
                <div className="mt-3 space-y-3">
                  {archivedInquiries.map(inquiry => (
                    <div key={inquiry.id} className="rounded-xl border border-gray-200 p-4 bg-gray-50 opacity-75" data-testid={`archived-inquiry-${inquiry.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{inquiry.name}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(inquiry.status)}`}>
                              {statusLabel(inquiry.status)}
                            </span>
                            {inquiry.category && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                                {inquiry.category}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{inquiry.email}</p>
                          <p className={`mt-1 text-sm ${inquiry.message.trim() ? '' : 'text-gray-400 italic'}`}>
                            {inquiryMessageOrPlaceholder(inquiry.message)}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`restore-btn-${inquiry.id}`}
                            onClick={() => restoreInquiry(inquiry.id)}
                          >
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            data-testid={`hard-delete-btn-${inquiry.id}`}
                            onClick={() => hardDeleteInquiry(inquiry.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {archivedInquiries.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No archived inquiries.</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {tab === 'scripts' && (
          <ReplyScriptsPanel scripts={replyScripts} onChange={fetchReplyScripts} />
        )}
      </div>


      {/* Retire house modal */}
      {retireTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Remove this house?</h2>
            <p className="text-sm text-gray-500 mb-4">
              The public URL will show a permanent removal notice. This ID can never be reassigned.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <select
              className="w-full p-2 border rounded mb-5 text-sm"
              value={retireReason}
              onChange={e => setRetireReason(e.target.value as typeof retireReason)}
            >
              <option value="behaviour">Community standards violation</option>
              <option value="owner_request">Owner request</option>
              <option value="test_duplicate">Test / duplicate</option>
              <option value="other">Other</option>
            </select>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRetireTarget(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={confirmRetireHouse}>Remove permanently</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(permDeleteTarget)}
        onOpenChange={(o) => { if (!o) setPermDeleteTarget(null) }}
        title={`Delete "${permDeleteTarget?.slug || permDeleteTarget?.qr_code_id || ''}" forever?`}
        description="This permanently erases the profile and its photos, and retires the access code so it can never be reused. There is no undo."
        confirmLabel={permDeleting ? 'Deleting...' : 'Yes, delete forever'}
        destructive
        onConfirm={permDeleteConfirmed}
      />
      <Toaster />
    </div>
  )
}

// A stat box that links to its tab: Live/Invited/Ready-for-Review/Total-Inquiries
// all share this shape, differing only in which tab, label, count, and color.
function StatLinkCard({
  testId,
  onSelect,
  label,
  count,
  colorClass,
}: {
  testId: string
  onSelect: () => void
  label: string
  count: number
  colorClass: string
}) {
  return (
    <button type="button" onClick={onSelect} className="block w-full text-start" data-testid={testId}>
      <Card className="h-full hover:border-amber-400 transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${colorClass}`}>{count}</p>
          <p className="text-xs text-gray-400 mt-1">view</p>
        </CardContent>
      </Card>
    </button>
  )
}

type RequestCardProps = {
  request: ProfileRequest
  diff?: EditDiffRow[] | null
  targetHouse?: House
  acting: boolean
  messageOpen: boolean
  messageText: string
  onMessageTextChange: (value: string) => void
  onOpenMessage: () => void
  onCloseMessage: () => void
  onApprove: () => void
  onDenyClick: () => void
  denyOpen: boolean
  denyNote: string
  onDenyNoteChange: (v: string) => void
  onConfirmDeny: () => void
  onCancelDeny: () => void
  onDismiss: () => void
  onSaveMessage: () => void
}

function RequestCard({
  request,
  diff,
  targetHouse,
  acting,
  messageOpen,
  messageText,
  onMessageTextChange,
  onOpenMessage,
  onCloseMessage,
  onApprove,
  onDenyClick,
  denyOpen,
  denyNote,
  onDenyNoteChange,
  onConfirmDeny,
  onCancelDeny,
  onDismiss,
  onSaveMessage,
}: RequestCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (request.payload || {}) as Record<string, any>
  const pending = request.status === 'pending'
  const isEdit = request.type === 'edit'

  return (
    <Card data-testid={`request-${request.id}`}>
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          {request.photo_url ? (
            <a href={request.photo_url} target="_blank" rel="noreferrer" className="shrink-0">
              <Image
                src={request.photo_url}
                alt="Birdhouse photo"
                width={96}
                height={96}
                className="w-24 h-24 object-cover rounded-lg border"
              />
            </a>
          ) : (
            <div className="w-24 h-24 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 flex items-center justify-center text-center shrink-0 px-2">
              No photo yet
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  request.type === 'new_profile'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {request.type === 'new_profile' ? 'New profile' : 'Edit'}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  request.status === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : request.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {request.status}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(request.created_at).toLocaleString()}
              </span>
            </div>

            <div className="mt-2 space-y-1 text-sm">
              <div>
                <span className="text-gray-500">From:</span>{' '}
                <span className="font-medium text-gray-900">
                  {request.requester_name || '(no name)'}
                </span>{' '}
                <span className="text-gray-500">({request.requester_email || 'no email'})</span>
              </div>

              {/* Edit requests show a before/after diff; new profiles show the raw bio. */}
              {isEdit ? (
                diff && diff.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-gray-200 divide-y" data-testid={`edit-diff-${request.id}`}>
                    {diff.map((row) => (
                      <div key={row.label} className="px-3 py-2 text-sm">
                        <div className="text-xs font-medium text-gray-500 mb-0.5">{row.label}</div>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-gray-400 line-through whitespace-pre-wrap break-words">
                            {row.current || '(empty)'}
                          </span>
                          <span className="text-gray-400">&rarr;</span>
                          <span className="text-emerald-700 font-medium whitespace-pre-wrap break-words">
                            {row.proposed || '(empty)'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : diff && diff.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No changes detected vs. the live profile.</p>
                ) : (
                  // Target house not found: fall back to raw payload.
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <p className="font-medium mb-1">
                      {targetHouse ? '' : `Could not find target house (${request.target_qr_code_id ?? 'unknown'}). Raw payload:`}
                    </p>
                    <pre className="whitespace-pre-wrap break-words text-gray-700">{JSON.stringify(payload, null, 2)}</pre>
                  </div>
                )
              ) : (
                payload.bio && <p className="text-gray-700 whitespace-pre-wrap">{payload.bio}</p>
              )}

              {request.community_question_answer && (
                <p className="text-xs text-gray-500">
                  Humanness answer: <em>{request.community_question_answer}</em>
                </p>
              )}
              {!isEdit && payload.lat != null && payload.lng != null && (
                <p className="text-xs text-gray-500">
                  Pinned at: {payload.lat.toFixed(5)}, {payload.lng.toFixed(5)}
                </p>
              )}
              {request.admin_note && (
                <p className="text-xs text-gray-500">
                  Note: <em>{request.admin_note}</em>
                </p>
              )}
            </div>

            {pending && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={onApprove}
                  disabled={acting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={onDenyClick} disabled={acting}>
                  Deny
                </Button>
                <Button size="sm" variant="outline" onClick={onDismiss} disabled={acting}>
                  Dismiss
                </Button>
                <Button size="sm" variant="ghost" onClick={onOpenMessage} disabled={acting}>
                  {messageOpen ? 'Close note' : 'Custom note'}
                </Button>
              </div>
            )}

            {denyOpen && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-red-700">Why is this being denied? (shown to the user)</p>
                <Textarea
                  value={denyNote}
                  onChange={(e) => onDenyNoteChange(e.target.value)}
                  rows={3}
                  placeholder="e.g. Your submission doesn't meet our community standards. We'd love to see more about the birdhouse's location and story."
                  className="border-red-200 focus:ring-red-400"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={onConfirmDeny}
                    disabled={acting || !denyNote.trim()}
                  >
                    Confirm denial
                  </Button>
                  <Button size="sm" variant="outline" onClick={onCancelDeny} disabled={acting}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {messageOpen && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={messageText}
                  onChange={(e) => onMessageTextChange(e.target.value)}
                  rows={3}
                  placeholder="Admin-only note for this request."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={onSaveMessage} disabled={acting || !messageText.trim()}>
                    Save note
                  </Button>
                  <Button size="sm" variant="outline" onClick={onCloseMessage} disabled={acting}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
