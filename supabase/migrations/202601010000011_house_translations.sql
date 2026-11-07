-- House profile translations, first version. One row per house and locale,
-- keyed by source_hash so staleness is cheap to detect. Replaced by the
-- per-field design in 012.

CREATE TABLE IF NOT EXISTS house_translations (
  qr_code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  artist_bio TEXT,
  bio TEXT,
  source_hash TEXT NOT NULL,
  translated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (qr_code_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_house_translations_locale ON house_translations (locale);

ALTER TABLE house_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads house_translations"
  ON house_translations FOR SELECT
  USING (true);
