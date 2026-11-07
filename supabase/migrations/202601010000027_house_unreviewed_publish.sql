-- 027: flag houses published live without admin review.
-- Two paths can put a house live with zero admin involvement: a steward's
-- auto-approved first save (src/app/api/house/update/route.ts), and claiming
-- a QR code while the global moderation setting is off
-- (src/app/api/house/claim/route.ts). unreviewed_publish_at is stamped by
-- those two paths only; clearing it back to NULL (admin clicks "Got it" in
-- the admin UI) is the acknowledgment. Manual admin approvals never
-- set it.
ALTER TABLE houses
  ADD COLUMN IF NOT EXISTS unreviewed_publish_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unreviewed_publish_source TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'houses_unreviewed_publish_source_check'
  ) THEN
    ALTER TABLE houses
      ADD CONSTRAINT houses_unreviewed_publish_source_check
        CHECK (unreviewed_publish_source IS NULL OR unreviewed_publish_source IN ('auto_approve_edit', 'no_moderation_claim'));
  END IF;
END $$;
