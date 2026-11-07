-- 005: rejection_note on profile_requests.
--
-- When an admin denies an edit request they must write a short note.
-- The note is shown to the steward on the edit page.

ALTER TABLE profile_requests
  ADD COLUMN IF NOT EXISTS rejection_note TEXT DEFAULT NULL;
