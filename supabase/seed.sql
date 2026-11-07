-- Fixture rows for the demo trail. Idempotent: every statement is ON CONFLICT DO NOTHING,
-- so it can be re-run after migrations without duplicating anything.
-- Everything here is invented: the district, the streets, the people, the businesses.
-- Loaded by `supabase db reset` after the migrations; on a hosted project run it once with psql.

BEGIN;

-- 8 QR codes: 6 assigned to houses below, 2 spare for the approval flow to hand out.
INSERT INTO qr_codes (id, edit_code) VALUES
  ('TEST3', 'LIVE'),
  ('P3RCH', 'Q7M2'),
  ('B4KER', 'X4ZP'),
  ('F3RRY', 'H8WK'),
  ('K9LN2', 'N6TY'),
  ('W8NTR', 'R3VB'),
  ('SP4RE', 'C5DG'),
  ('N3XT9', 'M9JF')
ON CONFLICT (id) DO NOTHING;

-- App settings the claim, update and admin pages read.
INSERT INTO settings (key, value) VALUES
  ('moderation_enabled', 'true'),
  ('auto_approve_all_edits', 'false')
ON CONFLICT (key) DO NOTHING;

-- 6 houses: three live (one with a French-source bio to exercise TranslatedField), one in review,
-- one invited (claimable with its edit code), one suspended.
INSERT INTO houses (qr_code_id, slug, artist_name, bio, artist_bio, lat, lng, status, include_in_promo, tags, bio_source_locale, artist_bio_source_locale, suspended_at, suspended_reason) VALUES
  ('TEST3', 'orchard-lantern', 'Mara Linden', 'A lantern-yellow house with a copper roof, hung on the oldest apple tree on Orchard Row. Painted over three rainy Sundays, one coat per Sunday.', 'Mara has lived on Orchard Row for eleven years and keeps two hives behind the bakery. She paints when the bees are asleep.', 48.1562, 11.5948, 'live', true, ARRAY['featured-artist']::text[], 'en', 'en', NULL, NULL),
  ('P3RCH', 'kiln-fire', 'Theo Baskett', 'Deep red with a black chimney, like the old pottery kiln the lane is named after. The entrance hole is ringed in gold leaf that has mostly washed off.', 'Theo runs the kiln at the community pottery on Kiln Lane and had never painted anything flat before this.', 48.1511, 11.5885, 'live', true, ARRAY['mural']::text[], 'en', 'en', NULL, NULL),
  ('B4KER', 'ferry-steps-blue', 'Priya Nandan', E'Bleu ciel avec des volets blancs, accroch\u00e9e sur la rampe en haut des Ferry Steps. Les enfants du quartier l''appellent la maison du passeur.', E'Priya a grandi au bord de la rivi\u00e8re et repeint ses volets chaque printemps. Celui-ci est son premier nichoir.', 48.1549, 11.5979, 'live', false, ARRAY['family']::text[], 'fr', 'fr', NULL, NULL),
  ('F3RRY', 'river-reed', 'Otis Fenwick', 'Reed green with a thatched look, waiting for a spot on the river path.', NULL, NULL, NULL, 'review', false, '{}'::text[], 'en', 'en', NULL, NULL),
  ('K9LN2', NULL, NULL, NULL, NULL, NULL, NULL, 'invited', false, '{}'::text[], 'en', 'en', NULL, NULL),
  ('W8NTR', 'winter-roost', 'Rosa Vance', 'Plum and cream, built for the cold months. Taken down for a repaint after the storm.', NULL, 48.1498, 11.5962, 'suspended', false, '{}'::text[], 'en', 'en', '2026-10-20T09:00:00+00:00', 'Taken down for repainting after storm damage')
ON CONFLICT (qr_code_id) DO NOTHING;

-- Translations for the live houses' bios (the enqueue trigger also queues these; rows here
-- mean the public pages render translated without a translation worker).
INSERT INTO house_translations (qr_code_id, locale, field, translated_text) VALUES
  ('TEST3', 'fr', 'bio', E'Une maison jaune lanterne au toit cuivr\u00e9, suspendue au plus vieux pommier d''Orchard Row. Peinte sur trois dimanches pluvieux, une couche par dimanche.'),
  ('TEST3', 'vi', 'bio', E'M\u1ed9t ng\u00f4i nh\u00e0 m\u00e0u v\u00e0ng \u0111\u00e8n l\u1ed3ng v\u1edbi m\u00e1i \u0111\u1ed3ng, treo tr\u00ean c\u00e2y t\u00e1o gi\u00e0 nh\u1ea5t \u1edf Orchard Row. V\u1ebd trong ba Ch\u1ee7 Nh\u1eadt m\u01b0a, m\u1ed7i Ch\u1ee7 Nh\u1eadt m\u1ed9t l\u1edbp s\u01a1n.'),
  ('TEST3', 'zh-Hans', 'bio', E'\u4e00\u5ea7\u706f\u7b3c\u9ec4\u8272\u3001\u94dc\u9876\u7684\u5c0f\u5c4b\uff0c\u6302\u5728 Orchard Row \u6700\u8001\u7684\u90a3\u68f5\u82f9\u679c\u6811\u4e0a\u3002\u7528\u4e09\u4e2a\u4e0b\u96e8\u7684\u5468\u65e5\u753b\u6210\uff0c\u6bcf\u4e2a\u5468\u65e5\u4e00\u5c42\u6f06\u3002'),
  ('TEST3', 'ar', 'bio', E'\u0628\u064a\u062a \u0623\u0635\u0641\u0631 \u0643\u0627\u0644\u0641\u0627\u0646\u0648\u0633 \u0628\u0633\u0642\u0641 \u0646\u062d\u0627\u0633\u064a\u060c \u0645\u0639\u0644\u0651\u0642 \u0639\u0644\u0649 \u0623\u0642\u062f\u0645 \u0634\u062c\u0631\u0629 \u062a\u0641\u0627\u062d \u0641\u064a \u2068Orchard Row\u2069. \u0631\u064f\u0633\u0645 \u0639\u0644\u0649 \u0645\u062f\u0649 \u062b\u0644\u0627\u062b\u0629 \u0622\u062d\u0627\u062f \u0645\u0645\u0637\u0631\u0629\u060c \u0637\u0628\u0642\u0629 \u0648\u0627\u062d\u062f\u0629 \u0643\u0644 \u0623\u062d\u062f.'),
  ('TEST3', 'fr', 'artist_bio', E'Mara habite Orchard Row depuis onze ans et garde deux ruches derri\u00e8re la boulangerie. Elle peint quand les abeilles dorment.'),
  ('TEST3', 'vi', 'artist_bio', E'Mara \u0111\u00e3 s\u1ed1ng \u1edf Orchard Row m\u01b0\u1eddi m\u1ed9t n\u0103m v\u00e0 nu\u00f4i hai t\u1ed5 ong sau ti\u1ec7m b\u00e1nh. C\u00f4 v\u1ebd khi l\u0169 ong \u0111\u00e3 ng\u1ee7.'),
  ('TEST3', 'zh-Hans', 'artist_bio', E'Mara \u5728 Orchard Row \u4f4f\u4e86\u5341\u4e00\u5e74\uff0c\u5728\u9762\u5305\u5e97\u540e\u9762\u517b\u7740\u4e24\u7bb1\u871c\u8702\u3002\u5979\u5728\u871c\u8702\u7761\u7740\u7684\u65f6\u5019\u753b\u753b\u3002'),
  ('TEST3', 'ar', 'artist_bio', E'\u062a\u0639\u064a\u0634 \u2068Mara\u2069 \u0641\u064a \u2068Orchard Row\u2069 \u0645\u0646\u0630 \u0623\u062d\u062f \u0639\u0634\u0631 \u0639\u0627\u0645\u064b\u0627 \u0648\u062a\u0631\u0628\u0651\u064a \u062e\u0644\u064a\u062a\u064a \u0646\u062d\u0644 \u062e\u0644\u0641 \u0627\u0644\u0645\u062e\u0628\u0632. \u062a\u0631\u0633\u0645 \u0639\u0646\u062f\u0645\u0627 \u064a\u0646\u0627\u0645 \u0627\u0644\u0646\u062d\u0644.'),
  ('P3RCH', 'fr', 'bio', E'Rouge profond avec une chemin\u00e9e noire, comme le vieux four de potier qui a donn\u00e9 son nom \u00e0 la ruelle. Le trou d''entr\u00e9e est cercl\u00e9 de feuille d''or, presque enti\u00e8rement d\u00e9lav\u00e9e.'),
  ('P3RCH', 'vi', 'bio', E'M\u00e0u \u0111\u1ecf th\u1eabm v\u1edbi \u1ed1ng kh\u00f3i \u0111en, gi\u1ed1ng l\u00f2 g\u1ed1m c\u0169 m\u00e0 con h\u1ebbm \u0111\u01b0\u1ee3c \u0111\u1eb7t t\u00ean theo. L\u1ed7 v\u00e0o \u0111\u01b0\u1ee3c vi\u1ec1n b\u1eb1ng l\u00e1 v\u00e0ng, gi\u1edd \u0111\u00e3 bong g\u1ea7n h\u1ebft.'),
  ('P3RCH', 'zh-Hans', 'bio', E'\u6df1\u7ea2\u8272\u914d\u9ed1\u8272\u70df\u56f1\uff0c\u50cf\u8fd9\u6761\u5df7\u5b50\u5f97\u540d\u7684\u90a3\u5ea7\u8001\u9676\u7a91\u3002\u5165\u53e3\u5b54\u5468\u56f4\u8d34\u8fc7\u91d1\u7b94\uff0c\u5982\u4eca\u5927\u591a\u5df2\u88ab\u96e8\u6c34\u51b2\u6389\u3002'),
  ('P3RCH', 'ar', 'bio', E'\u0623\u062d\u0645\u0631 \u063a\u0627\u0645\u0642 \u0628\u0645\u062f\u062e\u0646\u0629 \u0633\u0648\u062f\u0627\u0621\u060c \u0645\u062b\u0644 \u0641\u0631\u0646 \u0627\u0644\u0641\u062e\u0627\u0631 \u0627\u0644\u0642\u062f\u064a\u0645 \u0627\u0644\u0630\u064a \u0633\u064f\u0645\u0651\u064a \u0627\u0644\u0632\u0642\u0627\u0642 \u0628\u0627\u0633\u0645\u0647. \u0641\u062a\u062d\u0629 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u062d\u0627\u0637\u0629 \u0628\u0648\u0631\u0642 \u0630\u0647\u0628 \u0627\u0646\u062c\u0631\u0641 \u0645\u0639\u0638\u0645\u0647.'),
  ('P3RCH', 'fr', 'artist_bio', E'Theo s''occupe du four \u00e0 la poterie communautaire de Kiln Lane et n''avait jamais rien peint de plat avant ceci.'),
  ('P3RCH', 'vi', 'artist_bio', E'Theo tr\u00f4ng l\u00f2 nung \u1edf x\u01b0\u1edfng g\u1ed1m c\u1ed9ng \u0111\u1ed3ng tr\u00ean Kiln Lane v\u00e0 ch\u01b0a t\u1eebng v\u1ebd th\u1ee9 g\u00ec ph\u1eb3ng tr\u01b0\u1edbc \u0111\u00e2y.'),
  ('P3RCH', 'zh-Hans', 'artist_bio', E'Theo \u8d1f\u8d23 Kiln Lane \u793e\u533a\u9676\u827a\u574a\u7684\u7a91\u7089\uff0c\u5728\u6b64\u4e4b\u524d\u4ece\u6ca1\u5728\u5e73\u9762\u4e0a\u753b\u8fc7\u4e1c\u897f\u3002'),
  ('P3RCH', 'ar', 'artist_bio', E'\u064a\u062f\u064a\u0631 \u2068Theo\u2069 \u0627\u0644\u0641\u0631\u0646 \u0641\u064a \u0645\u0634\u063a\u0644 \u0627\u0644\u0641\u062e\u0627\u0631 \u0627\u0644\u0645\u062c\u062a\u0645\u0639\u064a \u0641\u064a \u2068Kiln Lane\u2069 \u0648\u0644\u0645 \u064a\u0631\u0633\u0645 \u0639\u0644\u0649 \u0633\u0637\u062d \u0645\u0633\u062a\u0648\u064d \u0642\u0637 \u0642\u0628\u0644 \u0647\u0630\u0627.'),
  ('B4KER', 'en', 'bio', 'Sky blue with white shutters, hung on the railing at the top of the Ferry Steps. The neighbourhood kids call it the ferryman''s house.'),
  ('B4KER', 'vi', 'bio', E'M\u00e0u xanh da tr\u1eddi v\u1edbi c\u1eeda ch\u1edbp tr\u1eafng, treo tr\u00ean lan can \u0111\u1ea7u Ferry Steps. B\u1ecdn tr\u1ebb trong khu ph\u1ed1 g\u1ecdi n\u00f3 l\u00e0 nh\u00e0 c\u1ee7a ng\u01b0\u1eddi l\u00e1i \u0111\u00f2.'),
  ('B4KER', 'zh-Hans', 'bio', E'\u5929\u84dd\u8272\u914d\u767d\u8272\u767e\u53f6\u7a97\uff0c\u6302\u5728 Ferry Steps \u9876\u7aef\u7684\u680f\u6746\u4e0a\u3002\u8857\u533a\u7684\u5b69\u5b50\u4eec\u53eb\u5b83\u6446\u6e21\u4eba\u7684\u5bb6\u3002'),
  ('B4KER', 'ar', 'bio', E'\u0623\u0632\u0631\u0642 \u0633\u0645\u0627\u0648\u064a \u0628\u0645\u0635\u0627\u0631\u064a\u0639 \u0628\u064a\u0636\u0627\u0621\u060c \u0645\u0639\u0644\u0651\u0642 \u0639\u0644\u0649 \u0627\u0644\u062f\u0631\u0627\u0628\u0632\u064a\u0646 \u0623\u0639\u0644\u0649 \u2068Ferry Steps\u2069. \u0623\u0637\u0641\u0627\u0644 \u0627\u0644\u062d\u064a \u064a\u0633\u0645\u0651\u0648\u0646\u0647 \u0628\u064a\u062a \u0627\u0644\u0645\u0639\u062f\u0651\u064a.'),
  ('B4KER', 'en', 'artist_bio', 'Priya grew up by the river and repaints her shutters every spring. This is her first birdhouse.'),
  ('B4KER', 'vi', 'artist_bio', E'Priya l\u1edbn l\u00ean b\u00ean b\u1edd s\u00f4ng v\u00e0 s\u01a1n l\u1ea1i c\u1eeda ch\u1edbp nh\u00e0 m\u00ecnh m\u1ed7i m\u00f9a xu\u00e2n. \u0110\u00e2y l\u00e0 ng\u00f4i nh\u00e0 chim \u0111\u1ea7u ti\u00ean c\u1ee7a c\u00f4.'),
  ('B4KER', 'zh-Hans', 'artist_bio', E'Priya \u5728\u6cb3\u8fb9\u957f\u5927\uff0c\u6bcf\u5e74\u6625\u5929\u90fd\u4f1a\u91cd\u65b0\u7c89\u5237\u81ea\u5bb6\u7684\u767e\u53f6\u7a97\u3002\u8fd9\u662f\u5979\u7684\u7b2c\u4e00\u4e2a\u9e1f\u5c4b\u3002'),
  ('B4KER', 'ar', 'artist_bio', E'\u0646\u0634\u0623\u062a \u2068Priya\u2069 \u0639\u0644\u0649 \u0636\u0641\u0629 \u0627\u0644\u0646\u0647\u0631 \u0648\u062a\u0639\u064a\u062f \u0637\u0644\u0627\u0621 \u0645\u0635\u0627\u0631\u064a\u0639\u0647\u0627 \u0643\u0644 \u0631\u0628\u064a\u0639. \u0647\u0630\u0627 \u0623\u0648\u0644 \u0628\u064a\u062a \u0637\u064a\u0648\u0631 \u0644\u0647\u0627.')
ON CONFLICT (qr_code_id, locale, field) DO NOTHING;

-- Flat illustrations stand in for photos. image_url is a site-relative path, which ppImage()
-- passes through untouched; storage_path is NOT NULL so it carries the same path.
INSERT INTO house_images (qr_code_id, image_url, storage_path, display_order, uploaded_by) VALUES
  ('TEST3', '/fixtures/house-01.svg', 'fixtures/house-01.svg', 1, 'admin'),
  ('TEST3', '/fixtures/house-02.svg', 'fixtures/house-02.svg', 2, 'admin'),
  ('P3RCH', '/fixtures/house-03.svg', 'fixtures/house-03.svg', 1, 'admin'),
  ('B4KER', '/fixtures/house-04.svg', 'fixtures/house-04.svg', 1, 'admin'),
  ('F3RRY', '/fixtures/house-05.svg', 'fixtures/house-05.svg', 1, 'admin'),
  ('W8NTR', '/fixtures/house-06.svg', 'fixtures/house-06.svg', 1, 'admin')
ON CONFLICT (qr_code_id, display_order) DO NOTHING;

-- Like counts for the carousel.
INSERT INTO house_likes (qr_code_id, count) VALUES
  ('TEST3', 12),
  ('P3RCH', 5)
ON CONFLICT (qr_code_id) DO NOTHING;

-- 2 street dots: birdhouses on the street with no profile yet.
INSERT INTO map_markers (id, label, lat, lng, status) VALUES
  ('6f1c2a40-9b1e-4d6a-8c3e-000000000001', 'Dot 001', 48.1528, 11.5901, 'active'),
  ('6f1c2a40-9b1e-4d6a-8c3e-000000000002', 'Dot 002', 48.1571, 11.5892, 'active')
ON CONFLICT (id) DO NOTHING;

-- 3 inquiries from the contact form, in three workflow states.
INSERT INTO inquiries (id, name, email, message, category, status) VALUES
  (1, 'Ivo Marsh', 'ivo@perchtrail.example', 'I''d love to host a birdhouse! I have a spot on the railing outside Kiln Lane Books.', 'host', 'new'),
  (2, 'Rosa Vance', 'rosa@perchtrail.example', 'I''m reaching out to learn more about volunteer opportunities. I can paint, carry ladders and talk to anyone.', 'volunteer', 'in_progress'),
  (3, 'Otis Fenwick', 'otis@perchtrail.example', 'I''m an artist interested in contributing to the project. My style is reeds, rivers and a lot of green.', 'artist', 'pickup_invite_sent')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('inquiries', 'id'), (SELECT COALESCE(MAX(id), 1) FROM inquiries));

-- 2 profile requests: one new profile waiting for approval, one approved edit on a live house.
INSERT INTO profile_requests (id, type, status, target_qr_code_id, payload, requester_name, requester_email, community_question_answer, turnstile_verified) VALUES
  ('9d2e7b10-3c4f-4a5b-9e6d-000000000001', 'new_profile', 'pending', NULL, '{"slug": "hollow-oven-loaf", "artist_name": "Ivo Marsh", "bio": "A bread-brown house with a crust-coloured roof, for the bakery wall."}', 'Ivo Marsh', 'ivo@perchtrail.example', 'birdhouse', true),
  ('9d2e7b10-3c4f-4a5b-9e6d-000000000002', 'edit', 'approved', 'P3RCH', '{"bio": "Deep red with a black chimney, like the old pottery kiln the lane is named after. The entrance hole is ringed in gold leaf that has mostly washed off."}', 'Theo Baskett', 'theo@perchtrail.example', 'birdhouse', true)
ON CONFLICT (id) DO NOTHING;

-- Canned replies for the admin inquiry composer.
INSERT INTO reply_scripts (id, label, body, sort_order) VALUES
  ('c3a9f1e2-7d8b-4c6a-b5e4-000000000001', 'Pickup invite', 'Thanks for writing! Your birdhouse is ready to collect at Hollow Oven Bakery, 12 Orchard Row, any afternoon this week. Paint, brushes and a hook are in the bag.', 1),
  ('c3a9f1e2-7d8b-4c6a-b5e4-000000000002', 'Host thank-you', 'Thank you for offering a spot. We will come by with a birdhouse and a drill in the next couple of weeks; reply with a time that suits you.', 2),
  ('c3a9f1e2-7d8b-4c6a-b5e4-000000000003', 'Volunteer welcome', 'Welcome aboard. The next painting session is on the events page; come ten minutes early and ask for whoever is holding the clipboard.', 3)
ON CONFLICT (id) DO NOTHING;

COMMIT;
