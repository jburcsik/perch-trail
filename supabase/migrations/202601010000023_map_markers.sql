-- 023: map_markers, marker-only birdhouses ("Street Dots").
-- Up to ~200 physical birdhouses without profiles render as small inert dots
-- on the public map. Kept OUT of houses on purpose: houses.qr_code_id is the
-- PK and an FK to qr_codes, so marker rows there would each burn a QR code
-- (and its meaningless edit code) from the 500-code pool. A QR is minted only
-- if a marker is promoted to a full birdhouse.
--
-- Ships with the promotion state, FK and final RLS so promotion needs no constraint swap.

CREATE TABLE IF NOT EXISTS map_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Admin-only label, e.g. "blue birdhouse on the maple tree". Never public.
  label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  -- active: hangs on the street; removed: physically taken down (removed_at
  -- is the history); promoted: graduated to a full house via the linked QR.
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed', 'promoted')),
  removed_at TIMESTAMPTZ,
  promoted_qr_code_id VARCHAR(5) UNIQUE REFERENCES qr_codes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_markers_active ON map_markers (status) WHERE status = 'active';

ALTER TABLE map_markers ENABLE ROW LEVEL SECURITY;

-- Admin writes match the houses convention: any authenticated user via RLS;
-- the ADMIN_EMAILS allowlist is enforced on sensitive API routes.
DROP POLICY IF EXISTS "Authenticated can manage map markers" ON map_markers;
CREATE POLICY "Authenticated can manage map markers" ON map_markers
  FOR ALL USING (auth.role() = 'authenticated');

-- Public read: active dots, plus promoted dots whose linked house is not yet
-- publicly live, so a birdhouse never vanishes from the map between
-- promotion and its profile going live, and comes back automatically if that
-- house is later suspended or archived. This policy is the single source of
-- truth for dot visibility; no app logic involved.
-- The subquery reads houses.status and archived_at as the querying role, so anon
-- must keep column SELECT on those two columns.
DROP POLICY IF EXISTS "Public can read visible map markers" ON map_markers;
CREATE POLICY "Public can read visible map markers" ON map_markers
  FOR SELECT USING (
    status = 'active'
    OR (
      status = 'promoted'
      AND NOT EXISTS (
        SELECT 1 FROM houses h
        WHERE h.qr_code_id = map_markers.promoted_qr_code_id
          AND h.status = 'live'
          AND h.archived_at IS NULL
      )
    )
  );

-- Column privacy (022 precedent): anon sees only id/lat/lng. Labels are
-- admin-only at the privilege level, not just the query level. Anon clients
-- must select explicit columns ('id,lat,lng'); '*' would be a permission
-- error by design.
REVOKE ALL ON map_markers FROM anon;
GRANT SELECT (id, lat, lng) ON map_markers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON map_markers TO authenticated;
GRANT ALL ON map_markers TO service_role;
