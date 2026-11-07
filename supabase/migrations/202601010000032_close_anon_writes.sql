-- 032: close the anon write and listing surface, and count edit-code failures atomically.
--
-- inquiries and profile_requests: the public forms post to API routes that
-- write with the service role, so anon needs no INSERT policy. The open
-- policies let a caller with the publishable key skip the bot checks, set
-- turnstile_verified, pre-link an inquiry to another house's qr_code_id, or
-- plant a payload that goes live on approval.
DROP POLICY IF EXISTS "Public can insert inquiries" ON inquiries;
DROP POLICY IF EXISTS "Public can insert profile requests" ON profile_requests;
REVOKE INSERT ON public.inquiries FROM anon;
REVOKE INSERT ON public.profile_requests FROM anon;

-- qr_codes: anon only needs to know whether a scanned id is retired. Listing
-- every id let a caller enumerate unclaimed codes to guess against.
DROP POLICY IF EXISTS "Public can read qr code status" ON qr_codes;
CREATE POLICY "Public can read retired qr codes" ON qr_codes
  FOR SELECT TO anon USING (retired_at IS NOT NULL);

-- Storage: both buckets are public, so objects are served by URL without a
-- SELECT policy. The SELECT policies only allowed listing every object,
-- including photos of houses that are not live.
DROP POLICY IF EXISTS "Public can read house images objects" ON storage.objects;
DROP POLICY IF EXISTS "Public can read request photos objects" ON storage.objects;

-- Atomic failure counter for edit-code guesses, so parallel wrong guesses
-- each count. Returns the new count. Callable by the service role only.
CREATE OR REPLACE FUNCTION public.record_edit_code_failure(p_qr_code_id TEXT)
RETURNS INTEGER
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE qr_codes
  SET failed_attempts = failed_attempts + 1
  WHERE id = p_qr_code_id
  RETURNING failed_attempts;
$$;
REVOKE EXECUTE ON FUNCTION public.record_edit_code_failure(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_edit_code_failure(text) TO service_role;
