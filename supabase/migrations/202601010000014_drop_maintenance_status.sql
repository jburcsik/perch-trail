-- 014: drop the maintenance status.
-- Drop the 'maintenance' status from the editorial flow.
--
-- Maintenance was a half-state that overlapped with both 'pending' (admin
-- hasn't published yet) and 'suspended' (admin has hidden a published
-- profile). The Live / Draft pending / Suspended pattern has no
-- room for it.
--
-- Each existing maintenance row becomes live + suspended_at so it stays hidden
-- until an admin restores it. The enum keeps the value; no code path writes it.
--
-- Idempotent.

UPDATE houses
SET status = 'live',
    suspended_at = COALESCE(suspended_at, NOW())
WHERE status = 'maintenance';
