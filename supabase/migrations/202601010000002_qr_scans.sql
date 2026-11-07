-- Migration 002: QR scan tracking

CREATE TABLE IF NOT EXISTS qr_scans (
  id          BIGSERIAL PRIMARY KEY,
  qr_code_id  VARCHAR(5) NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_qr_code_id ON qr_scans(qr_code_id);

ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can log a scan
CREATE POLICY "Anyone can log a scan"
  ON qr_scans FOR INSERT WITH CHECK (true);

-- Only authenticated admins can read scan data
CREATE POLICY "Admins can read scans"
  ON qr_scans FOR SELECT USING (auth.role() = 'authenticated');
