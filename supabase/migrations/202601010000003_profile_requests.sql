-- 003: profile_requests queue and the edit-review state on houses.
--
-- Idempotent where feasible. Safe to re-run.

-- ============================================
-- 1. profile_requests table
-- ============================================

CREATE TABLE IF NOT EXISTS profile_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 'new_profile' for someone asking to be featured, 'edit' for a proposed change
  type VARCHAR(16) NOT NULL CHECK (type IN ('new_profile', 'edit')),

  -- workflow state
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'dismissed')),

  -- For 'edit' requests, the house being modified. Null for 'new_profile'.
  target_qr_code_id VARCHAR(5) REFERENCES houses(qr_code_id) ON DELETE CASCADE,

  -- On approval for 'new_profile', which qr_code gets allocated to this person.
  assigned_qr_code_id VARCHAR(5) REFERENCES qr_codes(id) ON DELETE SET NULL,

  -- Submitted profile fields: { artist_name, caretaker_name, bio, lat, lng, slug, ... }
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Uploaded photo. Nullable; we accept submissions without a photo but won't approve them.
  photo_url TEXT,
  photo_storage_path TEXT,

  -- Requester contact details; retention is described on the privacy page.
  requester_name TEXT,
  requester_email TEXT,

  -- Humanness check: free-text answer to a community question (e.g. "What colour is the roof?")
  community_question_answer TEXT,

  -- Turnstile outcome at submit time
  turnstile_verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- Admin note (optional), custom message sent on dismissal, etc.
  admin_note TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID  -- auth.users.id of the admin who acted
);

CREATE INDEX IF NOT EXISTS idx_profile_requests_status ON profile_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_requests_type ON profile_requests(type);
CREATE INDEX IF NOT EXISTS idx_profile_requests_created_at ON profile_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_requests_target ON profile_requests(target_qr_code_id);

-- ============================================
-- 2. Extend houses with edit-review state
-- ============================================

ALTER TABLE houses
  ADD COLUMN IF NOT EXISTS pending_edit_id UUID REFERENCES profile_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_approve_edits BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consecutive_approved_edits INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_houses_pending_edit_id ON houses(pending_edit_id);

-- ============================================
-- 3. updated_at trigger for profile_requests
-- ============================================

CREATE OR REPLACE FUNCTION set_profile_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profile_requests_set_updated_at ON profile_requests;
CREATE TRIGGER profile_requests_set_updated_at
  BEFORE UPDATE ON profile_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_profile_requests_updated_at();

-- ============================================
-- 4. RLS
-- ============================================

ALTER TABLE profile_requests ENABLE ROW LEVEL SECURITY;

-- Requests are inserted by the service-role API route. (Migration 032 drops this policy.)
DROP POLICY IF EXISTS "Public can insert profile requests" ON profile_requests;
CREATE POLICY "Public can insert profile requests"
  ON profile_requests
  FOR INSERT
  WITH CHECK (
    type = 'new_profile'
    AND status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
  );

-- Only admins (authenticated Supabase users) can read or mutate.
DROP POLICY IF EXISTS "Admins can read profile requests" ON profile_requests;
CREATE POLICY "Admins can read profile requests"
  ON profile_requests
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can update profile requests" ON profile_requests;
CREATE POLICY "Admins can update profile requests"
  ON profile_requests
  FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can delete profile requests" ON profile_requests;
CREATE POLICY "Admins can delete profile requests"
  ON profile_requests
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================
-- Done.
-- ============================================
-- Note: the public request form captures name + email + humanness answer only.
-- No photo bucket is provisioned here. Owners add photos via their edit link
-- after approval, which goes into the existing `house-images` bucket.
