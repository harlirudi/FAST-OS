-- Fix RLS untuk akun Google: get_user_role() baca dari tabel users,
-- bukan JWT user_metadata.role (akun Google tidak punya role di user_metadata).
-- Akibat bug lama: cleaner Google tidak bisa membaca attendance_logs sendiri
-- (check-in tercatat via edge function tapi status app selalu "Belum Check-in").

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR(50)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon;

-- users: admin full access (ganti user_metadata.role -> helper)
DROP POLICY IF EXISTS "Admin full access on users" ON users;
CREATE POLICY "Admin full access on users" ON users FOR ALL
  USING (get_user_role() = 'admin');

-- users: supervisor baca cleaner di site sendiri
DROP POLICY IF EXISTS "Supervisor read cleaners in own site" ON users;
CREATE POLICY "Supervisor read cleaners in own site" ON users FOR SELECT
  USING (get_user_role() = 'supervisor' AND site_id = get_user_site_id());

-- sop_alerts
DROP POLICY IF EXISTS "Admin full access sop_alerts" ON sop_alerts;
CREATE POLICY "Admin full access sop_alerts" ON sop_alerts FOR ALL
  USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "Supervisor read sop_alerts in own site" ON sop_alerts;
CREATE POLICY "Supervisor read sop_alerts in own site" ON sop_alerts FOR SELECT
  USING (get_user_role() = 'supervisor' AND site_id = get_user_site_id());

-- Trigger anti-escalation: cek role via helper (bukan user_metadata.role)
CREATE OR REPLACE FUNCTION public.prevent_privilege_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF get_user_role() <> 'admin' THEN
    NEW.role := OLD.role;
    NEW.site_id := OLD.site_id;
  END IF;
  RETURN NEW;
END;
$function$;
