import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getUserFromToken, ok, err } from "../_shared/auth.ts";
import { haversineDistance } from "../_shared/geo.ts";
import { awsCompareFaces } from "../_shared/aws.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    .select("id, role, site_id, reference_photo_url")
    .eq("auth_id", payload.sub)
    .single();

  if (!dbUser || !["cleaner", "security"].includes(dbUser.role)) {
    return err("Hanya cleaner/security yang bisa absensi", 403);
  }
  if (!dbUser.site_id) {
    return err("Anda belum ditugaskan ke site manapun", 400);
  }

  const body = await req.json();
  const { type, latitude, longitude, photo_url, override_reason } = body;

  if (!type || !latitude || !longitude || !photo_url) {
    return err("Data tidak lengkap", 400);
  }

  const { data: site } = await supabase
    .from("sites")
    .select("latitude, longitude, radius_meters")
    .eq("id", dbUser.site_id)
    .single();

  if (!site) return err("Site tidak ditemukan", 400);

  const distance = haversineDistance(latitude, longitude, site.latitude, site.longitude);
  const isWithinRadius = distance <= site.radius_meters;

  if (!isWithinRadius && !override_reason) {
    return err(
      `Anda berada ${Math.round(distance)}m dari site (max ${site.radius_meters}m)`,
      400
    );
  }

  // Face match: jika user punya foto patokan, selfie harus cocok (AWS Rekognition)
  if (dbUser.reference_photo_url) {
    const { data: cfg } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "face_match_threshold")
      .maybeSingle();
    const threshold = parseInt(cfg?.value || "75", 10) || 75;

    const [selfieRes, refRes] = await Promise.all([
      fetch(photo_url),
      fetch(dbUser.reference_photo_url),
    ]);
    if (!selfieRes.ok || !refRes.ok) {
      return err("Gagal mengambil foto untuk verifikasi wajah", 500);
    }
    const [selfieBuf, refBuf] = await Promise.all([
      selfieRes.arrayBuffer(),
      refRes.arrayBuffer(),
    ]);
    const result = await awsCompareFaces(new Uint8Array(refBuf), new Uint8Array(selfieBuf));
    if (result.error) {
      return err(`Verifikasi wajah gagal: ${result.error}`, 500);
    }
    if (result.similarity < threshold) {
      return err(
        `Wajah tidak cocok dengan foto pendaftaran (kemiripan ${result.similarity}%, minimal ${threshold}%)`,
        400
      );
    }
  }

  const insertData: Record<string, unknown> = {
    user_id: dbUser.id,
    site_id: dbUser.site_id,
    type,
    latitude,
    longitude,
    distance_meters: Math.round(distance),
    override_reason: override_reason || null,
    is_flagged: !isWithinRadius && !!override_reason,
  };

  if (type === "check_in") {
    insertData.check_in_photo_url = photo_url;
  } else {
    insertData.check_out_photo_url = photo_url;
  }

  const { error: insertErr } = await supabase.from("attendance_logs").insert(insertData);
  if (insertErr) return err("Gagal menyimpan absensi", 500);

  if (type === "check_out") {
    await supabase
      .from("checkpoint_logs")
      .update({ status: "expired", finished_at: new Date().toISOString() })
      .eq("user_id", dbUser.id)
      .eq("status", "in_progress");
  }

  return ok({
    message: type === "check_in" ? "Check-in berhasil" : "Check-out berhasil",
    distance_meters: Math.round(distance),
    within_radius: isWithinRadius,
    is_flagged: !isWithinRadius && !!override_reason,
  });
});
