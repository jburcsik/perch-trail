-- 001: baseline schema for a fresh database. Later migrations build on this state.
--
-- Creates: qr_codes, houses, house_images, settings, inquiries,
-- inquiry_comments, their RLS policies, and the two storage buckets with
-- their policies. Idempotent.

-- ============================================
-- 1. qr_codes: the pool of 5-char ids and 4-char edit codes
-- ============================================

CREATE TABLE IF NOT EXISTS qr_codes (
  id VARCHAR(5) PRIMARY KEY,
  edit_code VARCHAR(4) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- No anon read: edit codes are the steward credential. Verification goes
-- through the service-role API routes. Migration 022 adds a column-restricted
-- anon read for the non-secret columns.
DROP POLICY IF EXISTS "Admin can manage qr codes" ON qr_codes;
CREATE POLICY "Admin can manage qr codes" ON qr_codes
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 2. houses
-- ============================================

CREATE TABLE IF NOT EXISTS houses (
  qr_code_id VARCHAR(5) PRIMARY KEY REFERENCES qr_codes(id) ON DELETE CASCADE,
  slug VARCHAR,
  artist_name VARCHAR,
  caretaker_name VARCHAR,
  bio TEXT,
  artist_bio TEXT DEFAULT NULL,
  tags TEXT[] DEFAULT '{}',
  is_invited_artist BOOLEAN NOT NULL DEFAULT FALSE,
  lat DECIMAL(10, 6),
  lng DECIMAL(10, 6),
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'maintenance')),
  include_in_promo BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_houses_status ON houses(status);
CREATE INDEX IF NOT EXISTS idx_houses_claimed_at ON houses(claimed_at);

ALTER TABLE houses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read live houses" ON houses;
CREATE POLICY "Public can read live houses" ON houses
  FOR SELECT USING (status = 'live' AND archived_at IS NULL);

DROP POLICY IF EXISTS "Admin can manage houses" ON houses;
CREATE POLICY "Admin can manage houses" ON houses
  FOR ALL USING (auth.role() = 'authenticated');

-- Public writes go through the service-role API routes (claim, update), so
-- there is no anon INSERT or UPDATE policy on houses.

-- ============================================
-- 3. house_images (up to 3 photos per house)
-- ============================================

CREATE TABLE IF NOT EXISTS house_images (
  id SERIAL PRIMARY KEY,
  qr_code_id VARCHAR(5) NOT NULL REFERENCES houses(qr_code_id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1 CHECK (display_order BETWEEN 1 AND 3),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by VARCHAR DEFAULT 'admin',
  file_size_kb INTEGER,
  UNIQUE(qr_code_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_house_images_qr_code_id ON house_images(qr_code_id);

ALTER TABLE house_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read house images" ON house_images;
CREATE POLICY "Public can read house images" ON house_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM houses
      WHERE houses.qr_code_id = house_images.qr_code_id
      AND houses.status = 'live'
      AND houses.archived_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admin can manage house images" ON house_images;
CREATE POLICY "Admin can manage house images" ON house_images
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 4. settings (global switches)
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read public settings" ON settings;
CREATE POLICY "Public can read public settings" ON settings
  FOR SELECT USING (key IN ('moderation_enabled'));

DROP POLICY IF EXISTS "Admin can manage settings" ON settings;
CREATE POLICY "Admin can manage settings" ON settings
  FOR ALL USING (auth.role() = 'authenticated');

INSERT INTO settings (key, value) VALUES ('moderation_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 5. inquiries and inquiry_comments (contact form and admin notes)
-- ============================================

CREATE TABLE IF NOT EXISTS inquiries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'resolved', 'ignored')),
  category TEXT DEFAULT NULL
    CHECK (category IN ('volunteer', 'donor', 'host', 'artist', 'partner', 'media', 'general', 'bug', 'other')),
  archived_at TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert inquiries" ON inquiries;
CREATE POLICY "Public can insert inquiries" ON inquiries
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can manage inquiries" ON inquiries;
CREATE POLICY "Admin can manage inquiries" ON inquiries
  FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS inquiry_comments (
  id          SERIAL PRIMARY KEY,
  inquiry_id  INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  comment     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inquiry_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage comments" ON inquiry_comments;
CREATE POLICY "Admin can manage comments" ON inquiry_comments
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 6. Storage buckets and policies
-- ============================================

-- house-images: approved photos, served through the Next image optimizer.
-- request-photos: the photo attached to a profile request, moved into
-- house-images on approval. Both public-read; writes come from the
-- service-role API routes (which bypass these policies), signed upload URLs,
-- and the authenticated admin pages.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('house-images', 'house-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('request-photos', 'request-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read house images objects" ON storage.objects;
CREATE POLICY "Public can read house images objects" ON storage.objects
  FOR SELECT USING (bucket_id = 'house-images');

DROP POLICY IF EXISTS "Public can read request photos objects" ON storage.objects;
CREATE POLICY "Public can read request photos objects" ON storage.objects
  FOR SELECT USING (bucket_id = 'request-photos');

DROP POLICY IF EXISTS "Authenticated can write house images objects" ON storage.objects;
CREATE POLICY "Authenticated can write house images objects" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'house-images')
  WITH CHECK (bucket_id = 'house-images');

DROP POLICY IF EXISTS "Authenticated can write request photos objects" ON storage.objects;
CREATE POLICY "Authenticated can write request photos objects" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'request-photos')
  WITH CHECK (bucket_id = 'request-photos');
