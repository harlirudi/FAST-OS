import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserFromToken, ok, err } from "../_shared/auth.ts";

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
    .select("id, role, site_id")
    .eq("auth_id", payload.sub)
    .single();

  if (!dbUser || dbUser.role !== "cleaner") {
    return err("Hanya cleaner yang bisa patroli", 403);
  }

  const body = await req.json();
  const { action } = body;

  // === START SESSION ===
  if (action === "start") {
    const { nfc_tag_id, qr_code_hash, latitude, longitude } = body;

    if (!latitude || !longitude) return err("Lokasi diperlukan", 400);
    if (!nfc_tag_id && !qr_code_hash) return err("NFC tag atau QR code diperlukan", 400);

    // Validasi check-in
    const today = new Date().toISOString().split("T")[0];
    const { data: lastCheckIn } = await supabase
      .from("attendance_logs")
      .select("id, type, timestamp")
      .eq("user_id", dbUser.id)
      .eq("type", "check_in")
      .gte("timestamp", today)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();

    if (!lastCheckIn) return err("Anda harus check-in terlebih dahulu", 400);

    // Cari checkpoint by NFC atau QR
    let query = supabase.from("checkpoints").select("id, name, site_id, latitude, longitude");
    if (nfc_tag_id) {
      query = query.eq("nfc_tag_id", nfc_tag_id);
    } else {
      query = query.eq("qr_code_hash", qr_code_hash);
    }

    const { data: checkpoint } = await query.single();
    if (!checkpoint) return err("Checkpoint tidak ditemukan", 404);

    if (checkpoint.site_id !== dbUser.site_id) {
      return err("Checkpoint ini bukan di site Anda", 400);
    }

    // Buat sesi baru
    const { data: session, error: insertErr } = await supabase
      .from("checkpoint_logs")
      .insert({
        checkpoint_id: checkpoint.id,
        user_id: dbUser.id,
        site_id: dbUser.site_id,
        status: "in_progress",
        log_type: "cleaning",
        start_latitude: latitude,
        start_longitude: longitude,
        before_photo_url: "", // diupload nanti
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) return err("Gagal memulai sesi", 500);

    return ok({
      session_id: session.id,
      checkpoint_name: checkpoint.name,
      message: "Sesi dimulai",
    });
  }

  // === UPLOAD PHOTO ===
  if (action === "photo") {
    const { session_id, photo_type, photo_url } = body;
    if (!session_id || !photo_type || !photo_url) return err("Data tidak lengkap", 400);

    const { data: session } = await supabase
      .from("checkpoint_logs")
      .select("id, status, user_id")
      .eq("id", session_id)
      .single();

    if (!session) return err("Sesi tidak ditemukan", 404);
    if (session.user_id !== dbUser.id) return err("Bukan sesi Anda", 403);
    if (session.status !== "in_progress") return err("Sesi sudah selesai", 400);

    const updateField = photo_type === "before" ? "before_photo_url" : "after_photo_url";
    await supabase
      .from("checkpoint_logs")
      .update({ [updateField]: photo_url })
      .eq("id", session_id);

    return ok({ message: "Foto tersimpan" });
  }

  // === COMPLETE SESSION ===
  if (action === "complete") {
    const { session_id, latitude, longitude, photo_url } = body;
    if (!session_id || !photo_url) return err("Foto sesudah diperlukan", 400);

    const { data: session } = await supabase
      .from("checkpoint_logs")
      .select("id, status, user_id, started_at")
      .eq("id", session_id)
      .single();

    if (!session) return err("Sesi tidak ditemukan", 404);
    if (session.user_id !== dbUser.id) return err("Bukan sesi Anda", 403);
    if (session.status !== "in_progress") return err("Sesi sudah selesai", 400);

    const finishedAt = new Date().toISOString();
    const duration = Math.round(
      (new Date(finishedAt).getTime() - new Date(session.started_at).getTime()) / 60000
    );

    await supabase
      .from("checkpoint_logs")
      .update({
        status: "completed",
        after_photo_url: photo_url,
        finished_at: finishedAt,
        duration_minutes: duration,
        end_latitude: latitude || null,
        end_longitude: longitude || null,
      })
      .eq("id", session_id);

    return ok({ message: "Sesi selesai", duration_minutes: duration });
  }

  return err("Action tidak dikenal", 400);
});
