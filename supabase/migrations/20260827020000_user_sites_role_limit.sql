-- ============================================================
-- BATCH 4 (lanjutan): user_sites — Cleaner/Security MAKSIMAL 1 site,
-- Supervisor boleh >1 site. Enforced di level DB.
-- ============================================================

-- 1. Bersihkan data lama yang melanggar (non-supervisor dengan >1 site)
DELETE FROM user_sites us
USING users u
WHERE us.user_id = u.id
  AND u.role <> 'supervisor'
  AND us.site_id <> COALESCE(u.site_id, us.site_id);

-- 2. Blokir INSERT/UPDATE yang membuat non-supervisor punya >1 site
CREATE OR REPLACE FUNCTION public.limit_user_sites_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.user_id AND role = 'supervisor'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM user_sites
      WHERE user_id = NEW.user_id AND site_id <> NEW.site_id
    ) THEN
      RAISE EXCEPTION 'Cleaner/Security hanya bisa 1 site';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS limit_user_sites_role ON user_sites;
CREATE TRIGGER limit_user_sites_role
BEFORE INSERT OR UPDATE ON user_sites
FOR EACH ROW EXECUTE FUNCTION public.limit_user_sites_role();

-- 3. Saat role user berubah jadi non-supervisor, sisakan hanya site utama
CREATE OR REPLACE FUNCTION public.trim_user_sites_on_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.role <> 'supervisor' THEN
    DELETE FROM user_sites
    WHERE user_id = NEW.id
      AND (NEW.site_id IS NULL OR site_id <> NEW.site_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trim_user_sites_on_role_change ON users;
CREATE TRIGGER trim_user_sites_on_role_change
BEFORE UPDATE OF role ON users
FOR EACH ROW EXECUTE FUNCTION public.trim_user_sites_on_role_change();
