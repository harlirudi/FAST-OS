-- ============================================================
-- BATCH 4: SUPERVISOR MULTI-SITE
-- user_sites: banyak site per user (supervisor utama, berlaku semua role)
-- ============================================================

-- 1. Tabel user_sites
CREATE TABLE IF NOT EXISTS user_sites (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, site_id)
);

-- 2. Migrasi data lama: user yang sudah punya site_id → masuk user_sites
INSERT INTO user_sites (user_id, site_id)
SELECT id, site_id FROM users WHERE site_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_user_sites_site_id ON user_sites(site_id);

-- 3. Helper: SEMUA site milik user saat ini (array)
CREATE OR REPLACE FUNCTION public.get_user_site_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT ARRAY(
    SELECT us.site_id
    FROM user_sites us
    JOIN users u ON u.id = us.user_id
    WHERE u.auth_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_user_site_ids TO authenticated;

-- 4. RLS user_sites: admin full, user baca baris miliknya
ALTER TABLE user_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on user_sites" ON user_sites;
CREATE POLICY "Admin full access on user_sites" ON user_sites FOR ALL
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "User read own sites" ON user_sites;
CREATE POLICY "User read own sites" ON user_sites FOR SELECT
  USING (user_id = public.get_user_internal_id());

-- 5. Supervisor: satu site -> ANY(user_sites) di semua policy terkait
-- sites
DROP POLICY IF EXISTS "Supervisor read own site" ON sites;
CREATE POLICY "Supervisor read own sites" ON sites FOR SELECT
  USING (public.get_user_role() = 'supervisor' AND id = ANY(public.get_user_site_ids()));

-- users (supervisor baca tim)
DROP POLICY IF EXISTS "Supervisor read cleaners in own site" ON users;
CREATE POLICY "Supervisor read cleaners in own sites" ON users FOR SELECT
  USING (
    public.get_user_role() = 'supervisor'
    AND site_id = ANY(public.get_user_site_ids())
  );

-- checkpoints
DROP POLICY IF EXISTS "Supervisor read/write checkpoints in own site" ON checkpoints;
CREATE POLICY "Supervisor read/write checkpoints in own sites" ON checkpoints FOR ALL
  USING (
    public.get_user_role() = 'supervisor'
    AND site_id = ANY(public.get_user_site_ids())
  );

-- attendance_logs
DROP POLICY IF EXISTS "Supervisor read attendance in own site" ON attendance_logs;
CREATE POLICY "Supervisor read attendance in own sites" ON attendance_logs FOR SELECT
  USING (
    public.get_user_role() = 'supervisor'
    AND site_id = ANY(public.get_user_site_ids())
  );

-- checkpoint_logs
DROP POLICY IF EXISTS "Supervisor read checkpoint logs in own site" ON checkpoint_logs;
CREATE POLICY "Supervisor read checkpoint logs in own sites" ON checkpoint_logs FOR SELECT
  USING (
    public.get_user_role() = 'supervisor'
    AND site_id = ANY(public.get_user_site_ids())
  );

DROP POLICY IF EXISTS "Supervisor insert inspection logs" ON checkpoint_logs;
CREATE POLICY "Supervisor insert inspection logs" ON checkpoint_logs FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'supervisor'
    AND log_type = 'inspection'
    AND site_id = ANY(public.get_user_site_ids())
  );

-- sop_alerts (samakan)
DROP POLICY IF EXISTS "Supervisor read sop_alerts in own site" ON sop_alerts;
CREATE POLICY "Supervisor read sop_alerts in own sites" ON sop_alerts FOR SELECT
  USING (
    public.get_user_role() = 'supervisor'
    AND site_id = ANY(public.get_user_site_ids())
  );
