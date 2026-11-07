-- 021: house status lifecycle.
-- Make houses.status the single source of truth for the lifecycle.
--
-- Before this, the lifecycle was encoded implicitly:
--   - "draft" (welcome link sent, not yet filled in) = status='live' + suspended_at
--     set + suspended_by NULL. These piled up in the dashboard's "Suspended" tab.
--   - "moderation suspended" = suspended_at + suspended_by set.
--   - status itself was only ever 'pending' | 'live' (plus deprecated 'maintenance').
--
-- New model: status is one of ('invited','review','live','suspended'):
--   invited   : welcome link sent, steward hasn't filled it in (was draft-suspension)
--   review    : steward saved first version, awaiting admin's first-publish approval
--               (was status='pending')
--   live      : published / public
--   suspended : admin moderation (suspended_by / suspended_reason kept for audit)
--
-- Soft delete stays orthogonal via archived_at (restorable). Hard delete unchanged.
-- Public visibility is now simply status='live' AND archived_at IS NULL.
--
-- Idempotent.

-- 1. Drop the old single-column CHECK so the backfill can write the new vocabulary.
ALTER TABLE houses DROP CONSTRAINT IF EXISTS houses_status_check;

-- 2. Backfill existing rows (order matters; rules are disjoint).
--    a) moderation suspensions become 'suspended' (keep suspended_at/by/reason as audit)
UPDATE houses SET status = 'suspended'
  WHERE suspended_by IS NOT NULL AND status <> 'suspended';

--    b) draft suspensions (pre-publish, no moderator) become 'invited', clear the flag
UPDATE houses SET status = 'invited', suspended_at = NULL
  WHERE suspended_at IS NOT NULL AND suspended_by IS NULL;

--    c) old admin-review drafts become 'review'
UPDATE houses SET status = 'review' WHERE status = 'pending';

--    d) defensive: any deprecated 'maintenance' left behind becomes 'live'
UPDATE houses SET status = 'live' WHERE status = 'maintenance';

-- 3. Re-add the constraint with the new vocabulary and default.
ALTER TABLE houses
  ADD CONSTRAINT houses_status_check CHECK (status IN ('invited','review','live','suspended'));

ALTER TABLE houses ALTER COLUMN status SET DEFAULT 'invited';

-- Public-read RLS already keys on status = 'live' (migration 001),
-- so invited/review/suspended remain hidden from anon with no policy change.
