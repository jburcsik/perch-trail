-- 019: track the source language of user-authored house bios.
--
-- Capturing the author's locale per field lets a bio written in any language be
-- translated into every other locale, English included, and rendered in its own
-- language for readers who share it. Existing rows default to 'en'.

ALTER TABLE houses
  ADD COLUMN IF NOT EXISTS bio_source_locale TEXT NOT NULL DEFAULT 'en'
    CHECK (bio_source_locale IN ('en', 'fr', 'vi', 'zh-Hans')),
  ADD COLUMN IF NOT EXISTS artist_bio_source_locale TEXT NOT NULL DEFAULT 'en'
    CHECK (artist_bio_source_locale IN ('en', 'fr', 'vi', 'zh-Hans'));
