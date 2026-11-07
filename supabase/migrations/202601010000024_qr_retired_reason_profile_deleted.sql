-- 024: allow 'profile_deleted' as a qr_codes.retired_reason.
--
-- The hard-delete route writes retired_reason = 'profile_deleted'.

ALTER TABLE qr_codes DROP CONSTRAINT IF EXISTS qr_codes_retired_reason_check;
ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_retired_reason_check
  CHECK (retired_reason IS NULL OR retired_reason IN
    ('behaviour', 'owner_request', 'test_duplicate', 'other', 'profile_deleted'));
