import type { HouseStatus } from './house-status'

export type House = {
  id: string
  qr_code_id: string
  slug: string | null
  status: HouseStatus
  artist_name: string | null
  bio: string | null
  artist_bio: string | null
  lat: number | null
  lng: number | null
  auto_approve_edits: boolean
  consecutive_approved_edits: number
  pending_edit_id: string | null
  suspended_at: string | null
  suspended_by: string | null
  suspended_reason: string | null
  archived_at: string | null
  claimed_at: string
  updated_at: string
}

export type Inquiry = {
  id: number
  name: string
  email: string
  message: string
  created_at: string
}

export type ProfileRequestStatus = 'pending' | 'approved' | 'denied' | 'dismissed'
export type ProfileRequestType = 'new_profile' | 'edit'

export type ProfileRequest = {
  id: string
  type: ProfileRequestType
  status: ProfileRequestStatus
  requester_name: string | null
  requester_email: string | null
  target_qr_code_id: string | null
  assigned_qr_code_id: string | null
  payload: Record<string, unknown> | null
  community_question_answer: string | null
  photo_storage_path: string | null
  photo_url: string | null
  rejection_note: string | null
  admin_note: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
}