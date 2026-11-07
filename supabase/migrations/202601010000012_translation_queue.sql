-- Translation pipeline v2: one queue + per-field translations.
--
-- The previous design (011) hashed the whole houses row, so editing one field
-- re-translated the other. This redesign:
--   * splits house_translations to (qr_code_id, locale, field): per-field rows.
--   * adds translation_queue, addressed by (source_ref, target_locale). One
--     row per pair for its entire lifetime; status flips between
--     'pending' / 'translated' / 'skipped' as the source changes and the
--     consumer drains it.
--   * adds Postgres triggers on `houses` so any change (admin or steward,
--     INSERT or UPDATE) enqueues exactly the changed fields times all target
--     locales. No app-level coordination needed.
--
-- The translation worker that drains the queue is external and not part of
-- this repository; nothing here calls an API or a scheduler.

-- 1. New per-field house_translations
DROP TABLE IF EXISTS house_translations;

CREATE TABLE house_translations (
  qr_code_id      TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  locale          TEXT NOT NULL,
  field           TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  translated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (qr_code_id, locale, field)
);

CREATE INDEX idx_house_translations_locale ON house_translations (locale);

ALTER TABLE house_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads house_translations"
  ON house_translations FOR SELECT
  USING (true);

-- 2. translation_queue
DROP TABLE IF EXISTS translation_queue;

CREATE TABLE translation_queue (
  source_ref       TEXT NOT NULL,           -- e.g. 'houses:ABCDE:bio' | 'messages:home.title'
  target_locale    TEXT NOT NULL,
  source_kind      TEXT NOT NULL CHECK (source_kind IN ('house_field', 'message_key')),
  source_text      TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'translated', 'skipped')),
  translated_text  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  translated_at    TIMESTAMPTZ,
  PRIMARY KEY (source_ref, target_locale)
);

CREATE INDEX idx_queue_status_locale ON translation_queue (status, target_locale);

ALTER TABLE translation_queue ENABLE ROW LEVEL SECURITY;
-- No public policies; service role only. Consumers run via service-role
-- scripts; the producer trigger below runs as SECURITY DEFINER.

-- 3. Trigger: enqueue translations on house INSERT/UPDATE
CREATE OR REPLACE FUNCTION enqueue_house_translations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_locales TEXT[] := ARRAY['fr', 'vi', 'zh-Hans'];
BEGIN
  -- Don't enqueue for suspended houses: they're hidden from the public, so
  -- translating them is wasted work. Re-enqueue happens on the next edit
  -- after restore.
  IF NEW.suspended_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF (TG_OP = 'INSERT' OR OLD.bio IS DISTINCT FROM NEW.bio)
     AND NEW.bio IS NOT NULL AND NEW.bio <> '' THEN
    INSERT INTO translation_queue (source_ref, target_locale, source_kind, source_text, status, created_at)
    SELECT 'houses:' || NEW.qr_code_id || ':bio', loc, 'house_field', NEW.bio, 'pending', NOW()
    FROM unnest(target_locales) loc
    ON CONFLICT (source_ref, target_locale) DO UPDATE
      SET source_text = EXCLUDED.source_text,
          status = 'pending',
          translated_text = NULL,
          translated_at = NULL,
          created_at = NOW();
  END IF;

  IF (TG_OP = 'INSERT' OR OLD.artist_bio IS DISTINCT FROM NEW.artist_bio)
     AND NEW.artist_bio IS NOT NULL AND NEW.artist_bio <> '' THEN
    INSERT INTO translation_queue (source_ref, target_locale, source_kind, source_text, status, created_at)
    SELECT 'houses:' || NEW.qr_code_id || ':artist_bio', loc, 'house_field', NEW.artist_bio, 'pending', NOW()
    FROM unnest(target_locales) loc
    ON CONFLICT (source_ref, target_locale) DO UPDATE
      SET source_text = EXCLUDED.source_text,
          status = 'pending',
          translated_text = NULL,
          translated_at = NULL,
          created_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_houses_enqueue_translations ON houses;
CREATE TRIGGER trg_houses_enqueue_translations
  AFTER INSERT OR UPDATE OF bio, artist_bio, suspended_at ON houses
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_house_translations();

-- 4. Trigger: clean queue when a house is deleted
CREATE OR REPLACE FUNCTION skip_queue_for_deleted_house()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE translation_queue
  SET status = 'skipped'
  WHERE source_kind = 'house_field'
    AND source_ref LIKE 'houses:' || OLD.qr_code_id || ':%'
    AND status = 'pending';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_houses_skip_queue ON houses;
CREATE TRIGGER trg_houses_skip_queue
  BEFORE DELETE ON houses
  FOR EACH ROW
  EXECUTE FUNCTION skip_queue_for_deleted_house();
