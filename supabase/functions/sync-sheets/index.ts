// Sinkronisasi terjadwal log -> Google Sheets (cron tiap 30 menit).
// Logika identik dengan web (tombol "Sync ke Google Sheets") — marker anti-duplikasi
// disimpan di app_config (sheets_last_sync_*). Dipanggil cron dengan header x-cron-secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SYNC_MARKER_ATT = "sheets_last_sync_attendance";
const SYNC_MARKER_CP = "sheets_last_sync_checkpoint";
const MAX_ROWS = 2000;

const SECRET = Deno.env.get("CRON_SECRET");
const CLIENT_EMAIL = Deno.env.get("GOOGLE_SHEETS_CLIENT_EMAIL");
const KEY_B64 = Deno.env.get("GOOGLE_SHEETS_PRIVATE_KEY_B64");
const SPREADSHEET_ID = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID");

function b64url(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  if (!KEY_B64 || !CLIENT_EMAIL) throw new Error("Env service account belum diset");
  const pem = atob(KEY_B64).replace(/\\n/g, "\n");
  const pemBody = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(enc.encode(JSON.stringify({
    iss: CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const signingInput = header + "." + claims;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput));
  const jwt = signingInput + "." + b64url(sig);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Token Google Sheets gagal (${res.status})`);
  const data = await res.json();
  return data.access_token as string;
}

async function appendToSheet(range: string, values: string[][]): Promise<void> {
  if (!SPREADSHEET_ID) throw new Error("SPREADSHEET_ID belum diset");
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error(`Append gagal (${res.status})`);
}

function syncTime(): string {
  return new Date().toLocaleString("id-ID");
}

Deno.serve(async (req) => {
  if (SECRET && req.headers.get("x-cron-secret") !== SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const nowIso = new Date().toISOString();

  const readMarker = async (key: string): Promise<string> => {
    const { data } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();
    return (data?.value as string) ?? nowIso;
  };
  const markerAtt = await readMarker(SYNC_MARKER_ATT);
  const markerCp = await readMarker(SYNC_MARKER_CP);

  let attCount = 0;
  let cpCount = 0;

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

  if (attCount > 0) {
    await supabase.from("app_config").upsert({ key: SYNC_MARKER_ATT, value: nowIso, updated_at: nowIso });
  }
  if (cpCount > 0) {
    await supabase.from("app_config").upsert({ key: SYNC_MARKER_CP, value: nowIso, updated_at: nowIso });
  }

  return new Response(
    JSON.stringify({ synced: { attendance: attCount, checkpoint: cpCount }, marker: nowIso }),
    { headers: { "content-type": "application/json" } }
  );
});
