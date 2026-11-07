-- Privacy: drop caretaker_name from houses.
-- The field tied a personal name to a street-visible location, which let anyone
-- triangulate "this person lives here." Hosts who want to be credited can do so
-- in the artist field; hosts who don't want to be linked to their address can
-- ask the project to hang the birdhouse somewhere public on their behalf.

ALTER TABLE houses
  DROP COLUMN IF EXISTS caretaker_name;
