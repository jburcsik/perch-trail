-- Migration 004: Tombstone retired QR codes
--
-- When a house is deleted for bad behaviour or any other reason, the qr_codes
-- row is NEVER hard-deleted; it is retired so the ID can never be reassigned
-- and the public URL returns a 410 Gone page instead of a claim form.

ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS retired_reason TEXT DEFAULT NULL
    CHECK (retired_reason IS NULL OR retired_reason IN ('behaviour', 'owner_request', 'test_duplicate', 'other'));

-- Fast lookup: exclude retired codes from the pool query
CREATE INDEX IF NOT EXISTS idx_qr_codes_retired ON qr_codes (retired_at)
  WHERE retired_at IS NOT NULL;
