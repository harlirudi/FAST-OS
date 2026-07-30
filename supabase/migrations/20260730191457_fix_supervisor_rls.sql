-- Helper: dapatkan site_id supervisor tanpa circular dependency
CREATE OR REPLACE FUNCTION public.get_supervisor_site_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT site_id FROM users WHERE auth_id = auth.uid();
$$;

-- Hapus policy supervisor lama
DROP POLICY IF EXISTS "Supervisor read own record" ON users;

-- Supervisor: baca cleaner di site yang sama
CREATE POLICY "Supervisor read cleaners in own site" ON users FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
    AND site_id = public.get_supervisor_site_id()
  );

-- Grant execute on helper
GRANT EXECUTE ON FUNCTION public.get_supervisor_site_id TO authenticated;
