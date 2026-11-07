-- Anonymous upvotes. Cookie-based dedup on the client; the table just
-- stores a per-house tally. We accept that the count can be gamed; this is a
-- community art project, not a competition.

CREATE TABLE IF NOT EXISTS house_likes (
  qr_code_id TEXT PRIMARY KEY REFERENCES qr_codes(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic increment via stored function keeps the route short and avoids
-- read-modify-write races between concurrent likes on the same house.
CREATE OR REPLACE FUNCTION increment_house_likes(p_qr_code_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO house_likes (qr_code_id, count, updated_at)
  VALUES (p_qr_code_id, 1, NOW())
  ON CONFLICT (qr_code_id)
  DO UPDATE SET count = house_likes.count + 1, updated_at = NOW()
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;

-- Public can call the function but cannot write to the table directly.
ALTER TABLE house_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads house_likes"
  ON house_likes FOR SELECT
  USING (true);
