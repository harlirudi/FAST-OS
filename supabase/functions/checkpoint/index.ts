import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getUserFromToken, ok, err } from "../_shared/auth.ts";
import { haversineDistance } from "../_shared/geo.ts";

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

  const body = await req.json();
  const { action } = body;

  // === START SESSION ===
  if (action === "start") {
    if (!dbUser || !["cleaner", "security"].includes(dbUser.role)) {
      return err("Hanya cleaner/security yang bisa patroli", 403);
    }
    const { nfc_tag_id, qr_code_hash, latitude, longitude, before_photo_url } = body;

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

    // Cari checkpoint by NFC, QR, atau dynamic token (dy_<id>_<unix>)
    let checkpoint: { id: string; name: string; site_id: string; latitude: number; longitude: number } | null = null;

    if (qr_code_hash && qr_code_hash.startsWith("dy_")) {
      // Dynamic token dari QR backup supervisor
      const parts = qr_code_hash.split("_");
      if (parts.length < 3) return err("Token QR tidak valid", 400);
      const checkpointId = parts[1];
      const issuedAt = parseInt(parts[2], 10);
      if (isNaN(issuedAt)) return err("Token QR tidak valid", 400);

      // Baca durasi berlaku dari config (default 5 menit)
      const { data: cfg } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "qr_validity_minutes")
        .maybeSingle();
      const validityMinutes = parseInt(cfg?.value || "5", 10) || 5;
      const validitySec = validityMinutes * 60;

      const nowSec = Math.floor(Date.now() / 1000);
      const age = nowSec - issuedAt;
      if (age < 0 || age > validitySec) {
        return err(`QR kedaluwarsa (berlaku ${validityMinutes} menit) — minta supervisor menampilkan QR baru`, 400);
      }

      const { data: cp } = await supabase
        .from("checkpoints")
        .select("id, name, site_id, latitude, longitude, type")
        .eq("id", checkpointId)
        .single();
      checkpoint = cp || null;
    } else if (nfc_tag_id) {
      const { data: cp } = await supabase
        .from("checkpoints")
        .select("id, name, site_id, latitude, longitude, type")
        .eq("nfc_tag_id", nfc_tag_id)
        .single();
      checkpoint = cp || null;
    } else {
      const { data: cp } = await supabase
        .from("checkpoints")
        .select("id, name, site_id, latitude, longitude, type")
        .eq("qr_code_hash", qr_code_hash)
        .single();
      checkpoint = cp || null;
    }

    if (!checkpoint) return err("Checkpoint tidak ditemukan", 404);

    if (checkpoint.site_id !== dbUser.site_id) {
      return err("Checkpoint ini bukan di site Anda", 400);
    }

    // Tipe checkpoint harus sesuai peran (cleaner -> cleaning, security -> security)
    const expectedType = dbUser.role === "security" ? "security" : "cleaning";
    if (checkpoint.type !== expectedType) {
      return err("Checkpoint ini bukan untuk peran Anda", 403);
    }

    // Validasi GPS: harus dalam radius 50m dari checkpoint
    const distanceToCheckpoint = haversineDistance(
      latitude, longitude,
      checkpoint.latitude, checkpoint.longitude
    );
    if (distanceToCheckpoint > 50) {
      return err(
        `Anda berada ${Math.round(distanceToCheckpoint)}m dari checkpoint ini (maks 50m)`,
        400
      );
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
        before_photo_url: before_photo_url || "",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) return err("Gagal memulai sesi", 500);

    // Ack: reset SOP alert untuk checkpoint ini
    await supabase
      .from("sop_alerts")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("checkpoint_id", checkpoint.id)
      .eq("acknowledged_at", null);

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

  // === INSPECTION (supervisor) ===
  if (action === "inspect") {
    const { nfc_tag_id, qr_code_hash, latitude, longitude, note } = body;

    if (!latitude || !longitude) return err("Lokasi diperlukan", 400);
    if (!nfc_tag_id && !qr_code_hash) return err("NFC tag atau QR code diperlukan", 400);

    if (dbUser.role !== "supervisor") return err("Hanya supervisor yang bisa inspeksi", 403);

    // Cari checkpoint
    let query = supabase.from("checkpoints").select("id, name, site_id");
    if (nfc_tag_id) query = query.eq("nfc_tag_id", nfc_tag_id);
    else query = query.eq("qr_code_hash", qr_code_hash);

    const { data: checkpoint } = await query.single();
    if (!checkpoint) return err("Checkpoint tidak ditemukan", 404);

    // Buat inspection log
    const { data: session, error: insertErr } = await supabase
      .from("checkpoint_logs")
      .insert({
        checkpoint_id: checkpoint.id,
        user_id: dbUser.id,
        site_id: dbUser.site_id,
        status: "completed",
        log_type: "inspection",
        start_latitude: latitude,
        start_longitude: longitude,
        before_photo_url: "",
        after_photo_url: "",
        inspection_note: note || null,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) return err("Gagal mencatat inspeksi", 500);

    return ok({
      session_id: session.id,
      checkpoint_name: checkpoint.name,
      message: "Inspeksi tercatat",
    });
  }

  return err("Action tidak dikenal", 400);
});
