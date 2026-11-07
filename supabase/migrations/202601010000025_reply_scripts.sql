-- 025: reply_scripts, reusable email-reply templates for the inquiry pane,
-- editable from the admin without a code change. Admin-only; no public read.

CREATE TABLE IF NOT EXISTS reply_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL CHECK (length(btrim(label)) > 0),
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reply_scripts_sort ON reply_scripts (sort_order, created_at);

ALTER TABLE reply_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can manage reply scripts" ON reply_scripts;
CREATE POLICY "Authenticated can manage reply scripts" ON reply_scripts
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- No public/anon access at all: this is admin-only content, never rendered
-- to a site visitor.
REVOKE ALL ON reply_scripts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON reply_scripts TO authenticated;
GRANT ALL ON reply_scripts TO service_role;

