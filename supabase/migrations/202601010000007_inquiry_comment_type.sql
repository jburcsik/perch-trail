-- Support email replies in inquiry_comments alongside internal notes.
ALTER TABLE inquiry_comments
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'note'
    CHECK (type IN ('note', 'reply')),
  ADD COLUMN IF NOT EXISTS sent_email_id TEXT DEFAULT NULL;
