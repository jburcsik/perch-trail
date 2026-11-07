-- Suspend a house: hides it from public surfaces while keeping the row intact.
-- Reversible via /api/admin/houses/[id]/unsuspend. Distinct from tombstoning,
-- which is permanent and locks the qr_code_id forever.

ALTER TABLE houses
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_houses_suspended ON houses (suspended_at)
  WHERE suspended_at IS NOT NULL;
