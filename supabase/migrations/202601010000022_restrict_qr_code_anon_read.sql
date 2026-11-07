-- 022: anon may read qr_codes status columns, never edit_code.
--
-- The edit code is the only credential for steward edit access, so the anon
-- role is limited to the non-secret columns with column-level grants.
-- Server code uses the service role (bypasses RLS + column grants). Admins read
-- as the authenticated role, which keeps full access (needed to copy edit URLs).
-- Anon still needs the non-secret columns; the steward page checks retired_at.
--
-- Idempotent.

-- Replace the wide-open public read policy with an explicit one (rows visible;
-- the column grants below are what actually hides edit_code).
DROP POLICY IF EXISTS "Public can read qr codes" ON qr_codes;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read qr code status" ON qr_codes;
CREATE POLICY "Public can read qr code status" ON qr_codes
  FOR SELECT USING (true);

-- Column-level lockdown: anon may read everything EXCEPT edit_code.
REVOKE SELECT ON public.qr_codes FROM anon;
GRANT SELECT (id, created_at, retired_at, retired_reason) ON public.qr_codes TO anon;
