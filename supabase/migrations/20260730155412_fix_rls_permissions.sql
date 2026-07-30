-- GRANT table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkpoints TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkpoint_logs TO authenticated, service_role;

-- Hapus policy users lama (dari initial_schema)
DROP POLICY IF EXISTS "Admin full access on users" ON users;
DROP POLICY IF EXISTS "Supervisor read cleaners in own site" ON users;
DROP POLICY IF EXISTS "Cleaner read own user record" ON users;

-- Admin: baca role dari JWT user_metadata
CREATE POLICY "Admin full access on users" ON users FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Non-admin: hanya lihat record sendiri
CREATE POLICY "Read own user record" ON users FOR SELECT
  USING (auth_id = auth.uid());

-- Update helper: baca role dari JWT
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR(50) AS $$
  SELECT auth.jwt() -> 'user_metadata' ->> 'role';
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.get_user_internal_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_site_id()
RETURNS UUID AS $$
  SELECT site_id FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
