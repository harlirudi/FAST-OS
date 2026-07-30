-- Auto-create public.users record saat auth.users baru dibuat
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (auth_id, name, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.phone, split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'cleaner'),
    NEW.phone
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Custom access token hook: inject role ke JWT claims
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
  user_record record;
BEGIN
  -- Pastikan claims ada (bisa null saat signup)
  claims := COALESCE(event->'claims', '{}'::jsonb);

  SELECT role, site_id, id INTO user_record
  FROM public.users
  WHERE auth_id = (event->>'user_id')::uuid;

  IF FOUND THEN
    claims := jsonb_set(claims, '{app_metadata,user_role}', to_jsonb(user_record.role));
    claims := jsonb_set(claims, '{app_metadata,site_id}', to_jsonb(user_record.site_id));
    claims := jsonb_set(claims, '{app_metadata,internal_user_id}', to_jsonb(user_record.id));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant permissions untuk hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM service_role;
