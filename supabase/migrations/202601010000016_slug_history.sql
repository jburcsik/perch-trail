-- Slug history + redirect support.
--
-- A house's public URL is /v/<slug>. When a steward edit (or admin edit) changes
-- the name, houses.slug is overwritten and every previously-shared /v/<old-slug>
-- link 404s. We keep a history of past slugs and redirect old to current.
--
-- The trigger captures EVERY slug change regardless of code path (approval,
-- auto-approve, admin edit, claim): a single source of truth.

CREATE TABLE IF NOT EXISTS slug_history (
  id          BIGSERIAL PRIMARY KEY,
  qr_code_id  VARCHAR(5) NOT NULL REFERENCES houses(qr_code_id) ON DELETE CASCADE,
  slug        VARCHAR NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookups are case-insensitive (slugs are matched lowercased).
CREATE INDEX IF NOT EXISTS idx_slug_history_slug ON slug_history (lower(slug));

-- Record the previous slug whenever houses.slug actually changes.
CREATE OR REPLACE FUNCTION record_old_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.slug IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    INSERT INTO slug_history (qr_code_id, slug) VALUES (OLD.qr_code_id, OLD.slug);
    -- If the new slug was previously someone's old slug, drop that stale row so
    -- a lookup of the new slug never redirects away from the current house.
    DELETE FROM slug_history WHERE lower(slug) = lower(NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_old_slug ON houses;
CREATE TRIGGER trg_record_old_slug
  BEFORE UPDATE OF slug ON houses
  FOR EACH ROW
  EXECUTE FUNCTION record_old_slug();

-- Slugs are public, non-sensitive. The /v/[slug] page (anon client) reads history
-- to resolve a redirect; writes happen only via the trigger (service role / definer).
ALTER TABLE slug_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read slug history" ON slug_history;
CREATE POLICY "Public can read slug history"
  ON slug_history
  FOR SELECT
  USING (true);
