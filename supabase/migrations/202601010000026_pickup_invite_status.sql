-- 026: 'pickup_invite_sent' inquiry status plus its timestamp, for the wait
-- between the pickup invite and the admin's manual welcome.

-- The existing status CHECK was added inline, so find it by column rather than
-- by a guessed name or by matching its definition text.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT con.conname INTO con_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'inquiries'
    AND con.contype = 'c'
    AND att.attname = 'status'
  LIMIT 1;
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE inquiries DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE inquiries
  ADD CONSTRAINT inquiries_status_check
    CHECK (status IN ('new', 'in_progress', 'pickup_invite_sent', 'resolved', 'ignored'));

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS pickup_invite_sent_at TIMESTAMPTZ DEFAULT NULL;
