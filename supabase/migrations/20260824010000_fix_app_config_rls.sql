-- app_config: RLS aktif tapi tanpa policy → semua akses diblokir.
-- Perbaikan: admin full access; SELECT untuk semua user terautentikasi
-- (mobile QrBackupScreen membaca qr_validity_minutes).

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access app_config" ON app_config;
CREATE POLICY "Admin full access app_config" ON app_config FOR ALL
  USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "Read app_config" ON app_config;
CREATE POLICY "Read app_config" ON app_config FOR SELECT
  USING (auth.role() = 'authenticated');
