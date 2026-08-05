import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserFromToken, ok, err } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return err("Tidak terautentikasi", 401);

  const payload = getUserFromToken(token);
  if (!payload?.sub) return err("Token tidak valid", 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, role, site_id")
    .eq("auth_id", payload.sub)
    .single();

  if (!dbUser || dbUser.role !== "supervisor") {
    return err("Hanya supervisor yang bisa set lokasi site", 403);
  }
  if (!dbUser.site_id) return err("Anda belum ditugaskan ke site", 400);

  const body = await req.json();
  const { latitude, longitude } = body;
  if (!latitude || !longitude) return err("Koordinat GPS diperlukan", 400);

  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", dbUser.site_id)
    .single();

  if (!site || siteErr) return err("Site tidak ditemukan", 404);

  const { error: updateErr } = await supabase
    .from("sites")
    .update({ latitude, longitude })
    .eq("id", site.id);

  if (updateErr) return err("Gagal update lokasi site", 500);

  return ok({ message: `Lokasi "${site.name}" diperbarui`, latitude, longitude });
});
