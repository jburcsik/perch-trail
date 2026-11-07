-- 020: source-relative translation targets for house bios.
--
-- Until now the enqueue trigger hardcoded fr/vi/zh-Hans as targets and assumed
-- the source was English. With per-field source locales (migration 019), a bio
-- can be authored in any locale. This rewrites the trigger so the target set is
-- (every supported locale EXCEPT the field's source locale). Effects:
--   * a non-English-authored bio now gets an ENGLISH translation
--   * a field never "translates" into its own source language
--   * existing English-source rows behave exactly as before (targets fr/vi/zh-Hans)
--
-- It also fires on source-locale changes and cleans up rows that become invalid
-- when a field is re-authored in a different language (the now-source locale must
-- not keep a queue row or a stored translation).
--
-- UI message strings are unaffected; they are translated in the repository's
-- locale files, not through this queue.

CREATE OR REPLACE FUNCTION enqueue_house_translations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  all_locales TEXT[] := ARRAY['en', 'fr', 'vi', 'zh-Hans'];
  bio_src  TEXT := COALESCE(NEW.bio_source_locale, 'en');
  abio_src TEXT := COALESCE(NEW.artist_bio_source_locale, 'en');
BEGIN
  -- Suspended houses are hidden from the public; don't waste translation work.
  IF NEW.suspended_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- bio
  IF (TG_OP = 'INSERT'
        OR OLD.bio IS DISTINCT FROM NEW.bio
        OR OLD.bio_source_locale IS DISTINCT FROM NEW.bio_source_locale)
     AND NEW.bio IS NOT NULL AND NEW.bio <> '' THEN

    -- A field is canonical in its own source language: never queue or store a
    -- translation for that locale (covers a re-language away from the old source).
    DELETE FROM translation_queue
      WHERE source_ref = 'houses:' || NEW.qr_code_id || ':bio'
        AND target_locale = bio_src;
    DELETE FROM house_translations
      WHERE qr_code_id = NEW.qr_code_id AND field = 'bio' AND locale = bio_src;

    INSERT INTO translation_queue (source_ref, target_locale, source_kind, source_text, status, created_at)
    SELECT 'houses:' || NEW.qr_code_id || ':bio', loc, 'house_field', NEW.bio, 'pending', NOW()
    FROM unnest(all_locales) loc
    WHERE loc <> bio_src
    ON CONFLICT (source_ref, target_locale) DO UPDATE
      SET source_text = EXCLUDED.source_text,
          status = 'pending',
          translated_text = NULL,
          translated_at = NULL,
          created_at = NOW();
  END IF;

  -- artist_bio
  IF (TG_OP = 'INSERT'
        OR OLD.artist_bio IS DISTINCT FROM NEW.artist_bio
        OR OLD.artist_bio_source_locale IS DISTINCT FROM NEW.artist_bio_source_locale)
     AND NEW.artist_bio IS NOT NULL AND NEW.artist_bio <> '' THEN

    DELETE FROM translation_queue
      WHERE source_ref = 'houses:' || NEW.qr_code_id || ':artist_bio'
        AND target_locale = abio_src;
    DELETE FROM house_translations
      WHERE qr_code_id = NEW.qr_code_id AND field = 'artist_bio' AND locale = abio_src;

    INSERT INTO translation_queue (source_ref, target_locale, source_kind, source_text, status, created_at)
    SELECT 'houses:' || NEW.qr_code_id || ':artist_bio', loc, 'house_field', NEW.artist_bio, 'pending', NOW()
    FROM unnest(all_locales) loc
    WHERE loc <> abio_src
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

-- Fire on source-locale changes too, so a re-language re-targets immediately.
DROP TRIGGER IF EXISTS trg_houses_enqueue_translations ON houses;
CREATE TRIGGER trg_houses_enqueue_translations
  AFTER INSERT OR UPDATE OF bio, artist_bio, bio_source_locale, artist_bio_source_locale, suspended_at ON houses
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_house_translations();
