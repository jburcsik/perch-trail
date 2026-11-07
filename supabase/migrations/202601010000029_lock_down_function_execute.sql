-- 029: close the public RPC surface on internal functions.
--
-- Postgres grants EXECUTE to PUBLIC by default, so every function in the
-- public schema was callable by anon and authenticated through
-- /rest/v1/rpc/<name>.
--
-- Trigger functions: a trigger fires its function without checking the
-- caller's EXECUTE privilege, so revoking it changes nothing for the triggers
-- and only removes the RPC endpoint.
--
-- increment_house_likes: the only caller is /api/house/like, through the
-- service-role client, behind a per-IP rate limit. A direct anon RPC skipped
-- that limit. service_role keeps EXECUTE.
--
-- search_path: pinned to public on the two functions that had none, matching
-- the other functions in this schema (Supabase lint 0011).

REVOKE EXECUTE ON FUNCTION public.enqueue_house_translations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_old_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skip_queue_for_deleted_house() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_profile_requests_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_house_likes(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_house_likes(text) TO service_role;

ALTER FUNCTION public.increment_house_likes(text) SET search_path = public;
ALTER FUNCTION public.set_profile_requests_updated_at() SET search_path = public;
