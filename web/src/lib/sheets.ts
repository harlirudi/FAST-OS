"use server";

// Export ke Google Sheets via Service Account (Google Sheets API).
// Dipakai oleh: tombol "Sync Sekarang" di halaman Log + sinkronisasi terjadwal
// (edge function sync-sheets menjalankan logika yang sama via cron 30 menit).
// Env: GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY_B64, GOOGLE_SHEETS_SPREADSHEET_ID
// (set via dashboard Vercel — CLI merusak nilai). Marker anti-duplikasi di app_config.

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

// Key disimpan sebagai BASE64 (GOOGLE_SHEETS_PRIVATE_KEY_B64) agar bebas
// masalah escaping newline di env var. Fallback: GOOGLE_SHEETS_PRIVATE_KEY
// (literal \n diubah jadi newline).
function resolvePrivateKey(): string {
  const b64 = process.env.GOOGLE_SHEETS_PRIVATE_KEY_B64;
  if (b64) {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  const raw = process.env.GOOGLE_SHEETS_PRIVATE_KEY ?? "";
  return raw
    .replace(/\\n/g, "\n")
    .replace(/^"|"$/g, "")
    .replace(/\\"/g, '"');
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const key = resolvePrivateKey();
  if (!email || !key) {
    throw new Error("Google Sheets belum dikonfigurasi (env service account).");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claims));
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signingInput + "." + base64url(signature),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal mendapatkan token Google Sheets (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

// Tambahkan baris ke spreadsheet. `range` misal "Absensi!A1" (append di bawah data yang ada).
export async function appendToSheet(range: string, values: string[][]): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID belum di-set.");

  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal menulis ke Google Sheets (${res.status}): ${body.slice(0, 300)}`);
  }
}

const SYNC_MARKER_ATT = "sheets_last_sync_attendance";
const SYNC_MARKER_CP = "sheets_last_sync_checkpoint";
const MAX_ROWS = 2000;

function syncTime(): string {
  return new Date().toLocaleString("id-ID");
}

// Sinkronkan log baru (sejak marker terakhir) ke Google Sheets.
// Marker anti-duplikasi disimpan di app_config — hanya baris baru yang di-append.
// Format kolom: Waktu Sinkron | Waktu Log | User | Site | ...
export async function syncToSheets(): Promise<string> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const readMarker = async (key: string): Promise<string> => {
    const { data } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();
    return (data?.value as string) ?? nowIso;
  };
  const markerAtt = await readMarker(SYNC_MARKER_ATT);
  const markerCp = await readMarker(SYNC_MARKER_CP);

  let attCount = 0;
  let cpCount = 0;

  // Absensi
  const { data: att } = await supabase
    .from("attendance_logs")
    .select("*, users(name), sites(name)")
    .gt("timestamp", markerAtt)
    .order("timestamp", { ascending: true })
    .limit(MAX_ROWS);
  if (att && att.length > 0) {
    const header = ["Waktu Sinkron", "Waktu Log", "User", "Site", "Tipe", "Jarak (m)", "Flag", "Alasan", "Foto"];
    const body = att.map((r: any) => [
      syncTime(),
      new Date(r.timestamp).toLocaleString("id-ID"),
      r.users?.name ?? "-", r.sites?.name ?? "-",
      r.type, String(r.distance_meters ?? ""),
      r.is_flagged ? "Ya" : "Tidak", r.override_reason ?? "-",
      r.check_in_photo_url || r.check_out_photo_url || "",
    ]);
    await appendToSheet("Absensi!A1", [header, ...body]);
    attCount = att.length;
  }

  // Checkpoint
  const { data: cp } = await supabase
    .from("checkpoint_logs")
    .select("*, users(name), checkpoints(name, type), sites(name)")
    .gt("created_at", markerCp)
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS);
  if (cp && cp.length > 0) {
    const header = ["Waktu Sinkron", "Waktu Log", "User", "Site", "Checkpoint", "Jenis", "Status", "Durasi (mnt)", "Sebelum", "Sesudah", "Catatan"];
    const body = cp.map((r: any) => [
      syncTime(),
      new Date(r.created_at).toLocaleString("id-ID"),
      r.users?.name ?? "-", r.sites?.name ?? "-",
      r.checkpoints?.name ?? "-", r.checkpoints?.type ?? "-",
      r.status, String(r.duration_minutes ?? ""),
      r.before_photo_url ?? "", r.after_photo_url ?? "",
      r.inspection_note ?? r.note ?? "",
    ]);
    await appendToSheet("Checkpoint!A1", [header, ...body]);
    cpCount = cp.length;
  }

  // Update marker hanya jika berhasil (gagal → retry siklus berikutnya)
  const setMarker = async (key: string, value: string) => {
    await supabase.from("app_config").upsert({ key, value, updated_at: new Date().toISOString() });
  };
  if (attCount > 0) await setMarker(SYNC_MARKER_ATT, nowIso);
  if (cpCount > 0) await setMarker(SYNC_MARKER_CP, nowIso);

  return `Sinkron selesai — ${attCount} baris absensi, ${cpCount} baris checkpoint ditulis ke Google Sheets.`;
}
