// Sinkronisasi log -> Google Sheets (cron 30 menit / dipicu admin via web).
// - Attendance: baris PAIR (check-in→check-out = blok Kerja; break_start→break_end = blok Istirahat)
//   dengan kolom Terlambat (WIB vs sites.start_time) dan Foto hanya utk record flagged.
// - Header ditulis SEKALI; data baru menyambung di bawah tabel (tidak mengulang judul).
// - Beautify: freeze header, bold+warna, filter dropdown, conditional formatting.
// Auth: x-cron-secret (cron) ATAU Bearer JWT user dengan role admin (tombol web).

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
  const key = await crypto.subtle.importKey("pkcs8", der.buffer as ArrayBuffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: CLIENT_EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })));
  const signingInput = header + "." + claims;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput));
  const jwt = signingInput + "." + b64url(sig);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Token Google Sheets gagal (${res.status})`);
  const data = await res.json();
  return data.access_token as string;
}

async function api(method: string, url: string, body?: unknown) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${url.split("/").pop()} gagal (${res.status}): ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Cari sheetId per nama tab (tidak hardcode — urutan/id tab bisa beda)
async function getSheetIdMap(): Promise<Record<string, number>> {
  const data = await api("GET", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties(sheetId,title)`);
  const map: Record<string, number> = {};
  for (const s of data.sheets ?? []) map[s.properties.title] = s.properties.sheetId;
  return map;
}

// Baca nilai untuk memeriksa header (A1)
async function readCell(range: string): Promise<string | undefined> {
  const data = await api("GET", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`);
  return data?.values?.[0]?.[0] as string | undefined;
}

async function writeHeader(sheetId: number, tabName: string, header: string[]): Promise<void> {
  await api("PUT", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A1?valueInputOption=USER_ENTERED`, {
    range: `${tabName}!A1`, majorDimension: "ROWS", values: [header],
  });
  const ruleColor = (r: number, g: number, b: number) => ({ red: r / 255, green: g / 255, blue: b / 255 });
  const col = header.length;
  // Beautify — tiap langkah berdiri sendiri; kegagalan satu tidak menggagalkan lainnya
  // (mis. setBasicFilter konflik jika range sudah menjadi tabel otomatis).
  const batch = (requests: any[]) =>
    api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, { requests });
  try {
    await batch([
      { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
      { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: col }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: ruleColor(219, 234, 254) } }, fields: "userEnteredFormat(textFormat,backgroundColor)" } },
    ]);
  } catch {}
  try {
    await batch([{ setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: col } } } }]);
  } catch {
    // Jika range sudah menjadi tabel, filter dropdown otomatis sudah tersedia
  }
}

async function addConditionalRules(sheetId: number, col: number) {
  const range = { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: col };
  const rules: any[] = [];
  const mk = (ranges: any, format: any) => ({ ranges: [ranges], booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=$H2="Ya"` }] }, format } });
  // H (8) Terlambat = "Ya" → merah
  if (col >= 8) rules.push({ ranges: [range], booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=$H2="Ya"` }] }, format: { backgroundColor: { red: 0.95, green: 0.85, blue: 0.85 } } } });
  // I (9) Flag = "Ya" → kuning
  if (col >= 9) rules.push({ ranges: [range], booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=$I2="Ya"` }] }, format: { backgroundColor: { red: 0.99, green: 0.95, blue: 0.8 } } } });
  // D (4) Jenis = "Istirahat" → abu
  if (col >= 4) rules.push({ ranges: [range], booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=$D2="Istirahat"` }] }, format: { backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 } } } });
  if (rules.length) {
    await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      requests: rules.map((r) => ({ addConditionalFormatRule: { rule: r, index: 0 } })),
    });
  }
}

function syncTime(): string { return new Date().toLocaleString("id-ID"); }

// Hapus tab & buat ulang dengan nama sama — membersihkan tabel otomatis
// yang membuat header/append bermasalah. Mengembalikan sheetId baru.
async function resetTab(title: string, oldSheetId: number): Promise<number> {
  const res = await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    requests: [
      { deleteSheet: { sheetId: oldSheetId } },
      { addSheet: { properties: { title } } },
    ],
  });
  return res.replies[1].addSheet.properties.sheetId;
}

// Pairing event absensi -> blok Kerja / Istirahat per user/site/hari.
// Event: check_in (mulai kerja), check_out (akhir kerja), break_start (mulai istirahat), break_end (akhir istirahat)
function pairEvents(events: any[], startTimes: Record<string, string>): string[][] {
  const rows: string[][] = [];
  const byKey = new Map<string, any[]>();
  for (const e of events) {
    const key = `${e.user_id}|${e.site_id}|${new Date(e.timestamp).toISOString().slice(0, 10)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(e);
  }
  const fmt = (ts: string) => new Date(ts).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const localHm = (ts: string) => {
    const d = new Date(ts);
    const local = new Date(d.getTime() + 7 * 3600 * 1000);
    return local.toISOString().slice(11, 16);
  };
  const dur = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));

  for (const [key, evts] of byKey) {
    const sorted = evts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const [userId, siteId, day] = key.split("|");
    const user = sorted[0].users?.name ?? "-";
    const site = sorted[0].sites?.name ?? "-";
    const startTime = startTimes[siteId] || "08:00";
    let open: any = null;
    let openKind: "kerja" | "istirahat" | null = null;

    const close = (endEvt: any) => {
      if (!open) return;
      const kind = openKind === "istirahat" ? "Istirahat" : "Kerja";
      const late = kind === "Kerja" ? (localHm(open.timestamp) > startTime ? "Ya" : "Tidak") : "";
      const flagged = open.is_flagged || endEvt.is_flagged;
      rows.push([
        day, user, site, kind,
        fmt(open.timestamp), fmt(endEvt.timestamp),
        String(dur(open.timestamp, endEvt.timestamp)),
        late,
        flagged ? `Ya${endEvt.override_reason || open.override_reason ? ` · ${endEvt.override_reason || open.override_reason}` : ""}` : "",
        flagged ? (open.check_in_photo_url || open.check_out_photo_url || endEvt.check_in_photo_url || endEvt.check_out_photo_url || "") : "",
      ]);
      open = null; openKind = null;
    };

    for (const ev of sorted) {
      if (ev.type === "break_start") {
        close(ev);
        open = ev; openKind = "istirahat";
      } else if (ev.type === "break_end") {
        close(ev);
        open = ev; openKind = "kerja";
      } else if (ev.type === "check_in") {
        close(ev);
        open = ev; openKind = "kerja";
      } else if (ev.type === "check_out") {
        close(ev);
      }
    }
    if (open) {
      // Blok masih terbuka (belum selesai)
      rows.push([
        day, user, site, openKind === "istirahat" ? "Istirahat" : "Kerja",
        fmt(open.timestamp), "-", "-",
        openKind === "kerja" ? (localHm(open.timestamp) > startTime ? "Ya" : "Tidak") : "",
        open.is_flagged ? `Ya${open.override_reason ? ` · ${open.override_reason}` : ""}` : "",
        open.check_in_photo_url || open.check_out_photo_url || "",
      ]);
    }
  }
  return rows;
}

Deno.serve(async (req) => {
  // Auth: cron secret ATAU admin JWT
  const cronOk = SECRET && req.headers.get("x-cron-secret") === SECRET;
  if (!cronOk) {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (token) {
      const supabaseCheck = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: { user } } = await supabaseCheck.auth.getUser(token);
      if (user) {
        const { data: dbUser } = await supabaseCheck.from("users").select("role").eq("auth_id", user.id).maybeSingle();
        if (dbUser?.role === "admin") {
          return handleSync(supabaseCheck, null);
        }
      }
    }
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return handleSync(supabase, null);
});

async function handleSync(supabase: any, _unused: null): Promise<Response> {
  try {
    const sheetIds = await getSheetIdMap();
    let attSheetId = sheetIds["Absensi"];
    let cpSheetId = sheetIds["Checkpoint"];
    if (attSheetId === undefined || cpSheetId === undefined) {
      throw new Error("Tab 'Absensi' atau 'Checkpoint' tidak ditemukan di spreadsheet");
    }

    const nowIso = new Date().toISOString();
    const readMarker = async (key: string): Promise<string> => {
      const { data } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();
      return (data?.value as string) ?? nowIso;
    };
    const markerAtt = await readMarker(SYNC_MARKER_ATT);
    const markerCp = await readMarker(SYNC_MARKER_CP);

    let attCount = 0;
    let cpCount = 0;

    // ===== Attendance (paired) =====
    const { data: att } = await supabase
      .from("attendance_logs")
      .select("*, users(name), sites(name)")
      .gt("timestamp", markerAtt)
      .order("timestamp", { ascending: true })
      .limit(MAX_ROWS);
    if (att && att.length > 0) {
      const { data: sites } = await supabase.from("sites").select("id, start_time");
      const startTimes: Record<string, string> = {};
      for (const s of sites || []) startTimes[s.id] = s.start_time || "08:00";

      const header = ["Tanggal", "User", "Site", "Jenis", "Masuk", "Keluar", "Durasi (mnt)", "Terlambat", "Flag/Alasan", "Foto"];
      const a1 = await readCell("Absensi!A1");
      if (a1 === undefined || a1 === "Waktu Sinkron" || a1 === "Waktu Log" || a1 === "Column 1") {
        // Tab kosong/format lama/tabel otomatis → buat ulang + header + beautify
        attSheetId = await resetTab("Absensi", attSheetId);
        await writeHeader(attSheetId, "Absensi", header);
        await addConditionalRules(attSheetId, header.length);
      }
      const rows = pairEvents(att, startTimes);
      if (rows.length > 0) {
        await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Absensi!A1:append?valueInputOption=USER_ENTERED`, { values: rows });
        attCount = rows.length;
      }
    }

    // ===== Checkpoint =====
    const { data: cp } = await supabase
      .from("checkpoint_logs")
      .select("*, users(name), checkpoints(name, type), sites(name)")
      .gt("created_at", markerCp)
      .order("created_at", { ascending: true })
      .limit(MAX_ROWS);
    if (cp && cp.length > 0) {
      const header = ["Tanggal", "User", "Site", "Checkpoint", "Jenis", "Status", "Durasi (mnt)", "Sebelum", "Sesudah", "Catatan"];
      const a1 = await readCell("Checkpoint!A1");
      if (a1 === undefined || a1 === "Waktu Sinkron" || a1 === "Waktu Log" || a1 === "Column 1") {
        cpSheetId = await resetTab("Checkpoint", cpSheetId);
        await writeHeader(cpSheetId, "Checkpoint", header);
      }
      const rows = cp.map((r: any) => [
        new Date(r.created_at).toISOString().slice(0, 10),
        r.users?.name ?? "-", r.sites?.name ?? "-",
        r.checkpoints?.name ?? "-", r.checkpoints?.type ?? "-",
        r.status, String(r.duration_minutes ?? ""),
        r.before_photo_url ?? "", r.after_photo_url ?? "",
        r.inspection_note ?? r.note ?? "",
      ]);
      await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Checkpoint!A1:append?valueInputOption=USER_ENTERED`, { values: rows });
      cpCount = rows.length;
    }

    if (attCount > 0) {
      await supabase.from("app_config").upsert({ key: SYNC_MARKER_ATT, value: nowIso, updated_at: nowIso });
    }
    if (cpCount > 0) {
      await supabase.from("app_config").upsert({ key: SYNC_MARKER_CP, value: nowIso, updated_at: nowIso });
    }

    return new Response(JSON.stringify({ synced: { attendance: attCount, checkpoint: cpCount }, marker: nowIso }), { headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e).slice(0, 300) }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
