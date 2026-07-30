import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserFromToken, ok, err } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
    .select("id, role, site_id")
    .eq("auth_id", payload.sub)
    .single();

  if (!dbUser || dbUser.role !== "cleaner") {
    return err("Hanya cleaner yang bisa absensi", 403);
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
