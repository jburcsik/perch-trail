-- 017: add auto_approve_all_edits global setting
-- When 'true', all edit submissions go live without admin review,
-- overriding the per-house auto_approve_edits flag.
INSERT INTO settings (key, value)
VALUES ('auto_approve_all_edits', 'false')
ON CONFLICT (key) DO NOTHING;
