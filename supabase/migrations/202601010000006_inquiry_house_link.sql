-- Link inquiries to houses: track welcome email sends and assigned QR codes.
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS assigned_qr_code_id TEXT REFERENCES qr_codes(id),
  ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_qr_code ON inquiries (assigned_qr_code_id)
  WHERE assigned_qr_code_id IS NOT NULL;
