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
    return err("Hanya supervisor yang bisa pairing", 403);
  }
  if (!dbUser.site_id) return err("Anda belum ditugaskan ke site", 400);

  const body = await req.json();
  const { checkpoint_id, nfc_tag_id, latitude, longitude } = body;

  if (!checkpoint_id || !nfc_tag_id) return err("Checkpoint dan NFC tag diperlukan", 400);
  if (!latitude || !longitude) return err("Lokasi GPS diperlukan", 400);

  // Cek checkpoint milik site supervisor
  const { data: checkpoint } = await supabase
    .from("checkpoints")
    .select("id, site_id")
    .eq("id", checkpoint_id)
    .single();

  if (!checkpoint) return err("Checkpoint tidak ditemukan", 404);
  if (checkpoint.site_id !== dbUser.site_id) {
    return err("Checkpoint ini bukan di site Anda", 400);
  }

  // Cek UID belum dipakai checkpoint lain
  const { data: existing } = await supabase
    .from("checkpoints")
    .select("id, name")
    .eq("nfc_tag_id", nfc_tag_id)
    .neq("id", checkpoint_id)
    .maybeSingle();

  if (existing) {
    return err(`UID sudah terpasang di "${existing.name}"`, 400);
  }

  // Update: pasang tag + koordinat dari GPS supervisor
  const tagPrefix = nfc_tag_id.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toLowerCase() || "0000";
  const random = Math.random().toString(36).slice(2, 8);
  const { error: updateErr } = await supabase
    .from("checkpoints")
    .update({
      nfc_tag_id,
      latitude,
      longitude,
      qr_code_hash: `qr_${tagPrefix}_v1_${random}`,
      qr_generation: 1,
    })
    .eq("id", checkpoint_id);

  if (updateErr) return err("Gagal pairing", 500);

  return ok({
    message: "NFC tag terpasang",
    checkpoint_id,
    nfc_tag_id,
    latitude,
    longitude,
  });
});
