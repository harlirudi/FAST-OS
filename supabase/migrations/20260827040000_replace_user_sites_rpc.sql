-- ============================================================
-- Ganti user_sites secara ATOMIS (satu transaksi): hapus semua +
-- insert baru. Mencegah duplicate key / race antar request.
-- Hanya admin; non-supervisor tetap dibatasi 1 site oleh trigger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.replace_user_sites(p_user_id UUID, p_site_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin yang bisa mengubah penugasan site';
  END IF;

  DELETE FROM user_sites WHERE user_id = p_user_id;

  IF p_site_ids IS NOT NULL AND cardinality(p_site_ids) > 0 THEN
    INSERT INTO user_sites (user_id, site_id)
    SELECT p_user_id, unnest(p_site_ids);
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.replace_user_sites(UUID, UUID[]) TO authenticated;
