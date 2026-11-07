-- 012 used a partial unique index on (source_ref, target_locale) WHERE
-- status='pending'. PostgREST/supabase-js can't target a partial index in
-- ON CONFLICT, so an upsert from a translation worker couldn't
-- dedup cleanly. This migration drops the queue and recreates it with a
-- full primary key on (source_ref, target_locale): one row per pair for
-- its lifetime, status flips between 'pending' / 'translated' / 'skipped'
-- as the source changes and the consumer drains it.
--
-- Same change applies to the trigger: ON CONFLICT now targets the full PK
-- and resets status back to 'pending' when the source text changes.

DROP TABLE IF EXISTS translation_queue;

CREATE TABLE translation_queue (
  source_ref       TEXT NOT NULL,
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

-- Re-create the enqueue trigger to use the full-PK upsert.
CREATE OR REPLACE FUNCTION enqueue_house_translations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_locales TEXT[] := ARRAY['fr', 'vi', 'zh-Hans'];
BEGIN
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
