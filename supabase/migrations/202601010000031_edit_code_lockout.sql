-- 031: per-code lockout for steward edit-code guesses.
-- Failed attempts are counted on the qr_codes row by src/lib/steward-edit-auth.ts;
-- after the limit the code is locked for a fixed window, whichever route or IP
-- the guesses came from. Neither column is granted to anon (see 022).
ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
