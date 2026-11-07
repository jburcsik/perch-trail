-- 030: allow 'ar' as a bio source locale.
--
-- Migration 019 added bio_source_locale / artist_bio_source_locale with a CHECK
-- limited to the four locales of the time. Migration 028 taught the enqueue
-- trigger about 'ar', and the claim and update routes stamp the viewer's locale
-- onto these columns. Widen both constraints to the full locale list in
-- src/i18n/locales.ts.

ALTER TABLE houses DROP CONSTRAINT IF EXISTS houses_bio_source_locale_check;
ALTER TABLE houses ADD CONSTRAINT houses_bio_source_locale_check
  CHECK (bio_source_locale IN ('en', 'fr', 'vi', 'zh-Hans', 'ar'));

ALTER TABLE houses DROP CONSTRAINT IF EXISTS houses_artist_bio_source_locale_check;
ALTER TABLE houses ADD CONSTRAINT houses_artist_bio_source_locale_check
  CHECK (artist_bio_source_locale IN ('en', 'fr', 'vi', 'zh-Hans', 'ar'));
