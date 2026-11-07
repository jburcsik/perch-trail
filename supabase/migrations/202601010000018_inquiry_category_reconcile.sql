-- 018: reconcile inquiries.category CHECK constraint with the values the app uses
--
-- The original constraint (migration 001) allowed only:
--   volunteer, donor, host, artist, partner, media, general, bug, other
--
-- The app also emits 'birdhouse', 'perch' (contact forms) and 'creative' (admin
-- dropdown). Widen the constraint to the full set the app uses.

ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_category_check;

ALTER TABLE inquiries ADD CONSTRAINT inquiries_category_check
  CHECK (category IN (
    'volunteer', 'donor', 'host', 'artist', 'creative',
    'birdhouse', 'perch',
    'partner', 'media', 'general', 'bug', 'other'
  ));
