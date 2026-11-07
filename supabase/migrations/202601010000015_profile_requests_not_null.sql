-- 015: requester_name and requester_email are required on every request.

-- First, update any existing NULL values to a placeholder
UPDATE profile_requests
SET requester_name = '(unknown)'
WHERE requester_name IS NULL;

UPDATE profile_requests
SET requester_email = '(unknown)'
WHERE requester_email IS NULL;

-- Now add the NOT NULL constraints with defaults
ALTER TABLE profile_requests
  ALTER COLUMN requester_name SET NOT NULL,
  ALTER COLUMN requester_name SET DEFAULT '(unknown)',
  ALTER COLUMN requester_email SET NOT NULL,
  ALTER COLUMN requester_email SET DEFAULT '(unknown)';
