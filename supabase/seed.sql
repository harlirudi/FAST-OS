-- Seed data for FacilityOS development

-- Clean existing data (order matters due to FK constraints)
DELETE FROM checkpoint_logs;
DELETE FROM attendance_logs;
DELETE FROM checkpoints;
DELETE FROM users;
DELETE FROM sites;

-- ============================================================
-- Sites
-- ============================================================
INSERT INTO sites (id, name, latitude, longitude, radius_meters) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Gedung Utama', -6.2088, 106.8456, 50),
  ('22222222-2222-2222-2222-222222222222', 'Gedung Annex', -6.2090, 106.8460, 50);

-- ============================================================
-- Users (note: create corresponding auth.users via Supabase Studio or API)
-- Passwords for reference (not stored here):
--   admin@facilityos.id   / password123
--   supervisor@facilityos.id / password123
--   cleaner@facilityos.id / password123
-- ============================================================
INSERT INTO users (id, name, role, site_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Admin User', 'admin', NULL),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Supervisor Budi', 'supervisor', '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Cleaner Andi', 'cleaner', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Cleaner Budi', 'cleaner', '11111111-1111-1111-1111-111111111111'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Cleaner Citra', 'cleaner', '22222222-2222-2222-2222-222222222222');

-- ============================================================
-- Checkpoints
-- ============================================================
INSERT INTO checkpoints (id, site_id, name, nfc_tag_id, qr_code_hash, display_order, latitude, longitude) VALUES
  -- Gedung Utama
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Toilet Lt. 1 Pria', '04A1B2C3D4E5F6', 'qr_utama_l1_pria', 1, -6.2088, 106.8456),
  ('c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Toilet Lt. 1 Wanita', '04A1B2C3D4E5F7', 'qr_utama_l1_wanita', 2, -6.2089, 106.8457),
  ('c3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Toilet Lt. 2 Pria', '04A1B2C3D4E5F8', 'qr_utama_l2_pria', 3, -6.2090, 106.8458),
  -- Gedung Annex
  ('c4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Toilet Lt. 1', '04A1B2C3D4E5F9', 'qr_annex_l1', 1, -6.2090, 106.8460),
  ('c5555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'Toilet Lt. 2', '04A1B2C3D4E500', 'qr_annex_l2', 2, -6.2091, 106.8461);
