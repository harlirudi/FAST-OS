// Sinkronisasi log -> Google Sheets (cron 30 menit / dipicu admin via web).
// SETIAP SINKRON = REBUILD PENUH (BATCH 4B): reset tab + header + beautify +
// tulis SEMUA baris. Bukan lagi marker-incremental — sehingga data lama sebelum
// marker ikut masuk dan record yang diubah admin (mis. override_reason) ikut
// diperbarui. Sheet = cermin penuh DB (web admin).
// - Attendance: baris PAIR (check-in→check-out = blok Kerja; break_start→break_end = blok Istirahat)
//   dengan kolom Terlambat (WIB vs sites.start_time) dan Foto hanya utk record flagged.
// - Beautify: freeze header, bold+warna, filter dropdown, conditional formatting.
// Auth: x-cron-secret (cron) ATAU Bearer JWT user dengan role admin (tombol web).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SYNC_MARKER_ATT = "sheets_last_sync_attendance";
const SYNC_MARKER_CP = "sheets_last_sync_checkpoint";
const MAX_ROWS = 5000;
const WIB = 7 * 3600 * 1000;
const wibDay = (ts: string) => new Date(new Date(ts).getTime() + WIB).toISOString().slice(0, 10);

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

// Hapus tab & buat ulang dengan nama sama — membersihkan tabel otomatis
// yang membuat header/append bermasalah. Mengembalikan sheetId baru.
async function resetTab(title: string, oldSheetId: number, hidden = false): Promise<number> {
  const res = await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    requests: [
      { deleteSheet: { sheetId: oldSheetId } },
      { addSheet: { properties: { title, ...(hidden ? { hidden: true } : {}) } } },
    ],
  });
  return res.replies[1].addSheet.properties.sheetId;
}

// Pairing event absensi -> blok Kerja / Istirahat per user/site/hari.
// Event: check_in (mulai kerja), check_out (akhir kerja), break_start (mulai istirahat), break_end (akhir istirahat)
// TERLAMBAT: hanya check-in PERTAMA hari itu (per user) vs jam masuk site-nya.
function pairEvents(events: any[], startTimes: Record<string, string>): string[][] {
  const rows: string[][] = [];
  const byKey = new Map<string, any[]>();
  for (const e of events) {
    const key = `${e.user_id}|${e.site_id}|${wibDay(e.timestamp)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(e);
  }
  // Check-in pertama per user per hari
  const firstCheckIn = new Map<string, { id: string }>();
  for (const [key, evts] of byKey) {
    const [userId, , day] = key.split("|");
    const first = evts.filter((e) => e.type === "check_in")
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
    if (first) firstCheckIn.set(`${userId}|${day}`, { id: first.id });
  }
  const fmt = (ts: string) => new Date(ts).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const localHm = (ts: string) => {
    const d = new Date(ts);
    return new Date(d.getTime() + WIB).toISOString().slice(11, 16);
  };
  const dur = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));

  for (const [key, evts] of byKey) {
    const sorted = evts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const [userId, siteId, day] = key.split("|");
    const user = sorted[0].users?.name ?? "-";
    const site = sorted[0].sites?.name ?? "-";
    const startTime = startTimes[siteId] || "08:00";
    const dayFirstCheckIn = firstCheckIn.get(`${userId}|${day}`);
    let open: any = null;
    let openKind: "kerja" | "istirahat" | null = null;

    const close = (endEvt: any) => {
      if (!open) return;
      const kind = openKind === "istirahat" ? "Istirahat" : "Kerja";
      // Terlambat HANYA jika blok dibuka oleh check-in PERTAMA hari itu
      const late = kind === "Kerja" && open.type === "check_in" && dayFirstCheckIn?.id === open.id
        ? (localHm(open.timestamp) > startTime ? "Ya" : "Tidak")
        : "";
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
        "", // blok terbuka tidak dinilai terlambat
        open.is_flagged ? `Ya${open.override_reason ? ` · ${open.override_reason}` : ""}` : "",
        open.check_in_photo_url || open.check_out_photo_url || "",
      ]);
    }
  }
  return rows;
}

// Rekap harian per user: Jam Kerja (cap target: 8j cleaner/security, 7j supervisor),
// Istirahat, Perjalanan antar-site (supervisor), Terlambat (check-in pertama), Status.
// Hari tanpa check-in = "Absen".
function buildDailyRecap(events: any[], startTimes: Record<string, string>, siteNames: Record<string, string>, users: any[]): string[][] {
  const byUserDay = new Map<string, any[]>();
  for (const e of events) {
    const key = `${e.user_id}|${wibDay(e.timestamp)}`;
    if (!byUserDay.has(key)) byUserDay.set(key, []);
    byUserDay.get(key)!.push(e);
  }
  const dur = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  const localHm = (ts: string) => new Date(new Date(ts).getTime() + WIB).toISOString().slice(11, 16);
  const rows: string[][] = [];
  const daysWithData = new Set<string>();
  const fmtHM = (min: number) => `${Math.floor(min / 60)}j ${min % 60}m`;
  const roleLabel: Record<string, string> = { cleaner: "Cleaner", security: "Security", supervisor: "Supervisor", admin: "Admin" };

  for (const [key, evts] of byUserDay) {
    const [userId, day] = key.split("|");
    daysWithData.add(day);
    const sorted = [...evts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const role = sorted[0].users?.role ?? "cleaner";
    const targetMin = role === "supervisor" ? 420 : 480;

    let kerjaMin = 0;
    let istirahatMin = 0;
    const closedBlocks: { start: number; end: number }[] = [];
    let open: any = null;
    let openKind: string | null = null;
    const close = (endEvt: any) => {
      if (!open) return;
      const d = dur(open.timestamp, endEvt.timestamp);
      if (openKind === "istirahat") istirahatMin += d;
      else {
        kerjaMin += d;
        closedBlocks.push({ start: new Date(open.timestamp).getTime(), end: new Date(endEvt.timestamp).getTime() });
      }
      open = null; openKind = null;
    };
    for (const ev of sorted) {
      if (ev.type === "break_start") { close(ev); open = ev; openKind = "istirahat"; }
      else if (ev.type === "break_end" || ev.type === "check_in") { close(ev); open = ev; openKind = "kerja"; }
      else if (ev.type === "check_out") { close(ev); }
    }

    let perjalananMin = 0;
    if (role === "supervisor") {
      closedBlocks.sort((a, b) => a.start - b.start);
      for (let i = 1; i < closedBlocks.length; i++) {
        const gap = Math.round((closedBlocks[i].start - closedBlocks[i - 1].end) / 60000);
        if (gap > 0) perjalananMin += gap;
      }
    }

    const firstCheckIn = sorted.find((e) => e.type === "check_in");
    const terlambat = firstCheckIn
      ? (localHm(firstCheckIn.timestamp) > (startTimes[firstCheckIn.site_id] || "08:00") ? "Ya" : "Tidak")
      : "";
    const status = !firstCheckIn ? "Absen" : kerjaMin >= targetMin ? "Lengkap" : `Kurang ${targetMin - kerjaMin}m`;

    // Kolom tambahan "Sites" (untuk filter Site di tab Rekap)
    const siteList = [...new Set(sorted.map((e) => siteNames[e.site_id]).filter(Boolean))].join(" | ");

    rows.push([
      day,
      sorted[0].users?.name ?? "-",
      roleLabel[role] ?? role,
      fmtHM(Math.min(kerjaMin, targetMin)),
      istirahatMin > 0 ? fmtHM(istirahatMin) : "-",
      perjalananMin > 0 ? fmtHM(perjalananMin) : "-",
      terlambat,
      status,
      siteList,
    ]);
  }

  // Absen: user aktif tanpa event pada hari yang ada datanya
  const activeUsers = (users || []).filter((u) => ["cleaner", "security", "supervisor"].includes(u.role));
  for (const day of daysWithData) {
    for (const u of activeUsers) {
      if (!byUserDay.has(`${u.id}|${day}`)) {
        rows.push([day, u.name, roleLabel[u.role] ?? u.role, "-", "-", "-", "", "Absen", ""]);
      }
    }
  }

  return rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
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

// ===== LAYOUT "SAMA PERSIS WEB LOG" =====
// Row 1 : baris filter — Dari [kalender] Sampai [kalender] Site [dropdown] User [dropdown] Tipe [dropdown] Flag [dropdown]
// Row 2 : spacer
// Row 3 : header tabel
// Row 4+ : =IFERROR(FILTER('Data...'!A2:J, ...kondisi dari baris filter...))
//   → tabel otomatis terfilter seperti web log (tanpa Apps Script).
// Data mentah disimpan di tab TERSEMBUNYI "DataAbsensi"/"DataCheckpoint"/"DataRekap".

type FilterControl = {
  label: string;
  kind: "date" | "dropdown";
  options?: string[];
};

async function putValues(tabName: string, cell: string, values: any[][], mode: "USER_ENTERED" | "RAW" = "USER_ENTERED"): Promise<void> {
  if (!values.length) return;
  await api("PUT", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!${cell}?valueInputOption=${mode}`, {
    range: `${tabName}!${cell}`, majorDimension: "ROWS", values,
  });
}

// Tulis layout filter bar + header + formula FILTER + validasi data (dropdown/kalender) + beautify.
async function writeWebLogLayout(
  sheetId: number,
  tabName: string,
  dataTab: string,
  header: string[],
  controls: FilterControl[],
  formula: string,
  cfRules: { startCol: number; formula: string; color: { r: number; g: number; b: number } }[],
  widths?: number[],
): Promise<void> {
  const row1: string[] = [];
  // Dari/Sampai default = HARI INI (sama seperti web log); kosongkan? → tetap hari ini
  const today = new Date(Date.now() + WIB).toISOString().slice(0, 10);
  controls.forEach((c, i) => {
    row1[Math.max(row1.length, i * 2)] = c.label;
    row1[i * 2 + 1] = c.kind === "dropdown" ? "Semua" : today;
  });
  await putValues(tabName, "A1", [row1]);
  await putValues(tabName, "A3", [header]);
  await putValues(tabName, "A4", [[formula]]);

  const requests: any[] = [];
  const colOf = (idx: number) => ({ sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: idx * 2 + 1, endColumnIndex: idx * 2 + 2 });
  controls.forEach((c, i) => {
    if (c.kind === "date") {
      requests.push({
        setDataValidation: {
          range: colOf(i),
          rule: { condition: { type: "DATE_ON_OR_AFTER", values: [{ userEnteredValue: "1900-01-01" }] }, strict: true, showCustomUi: true },
        },
      });
      requests.push({
        repeatCell: {
          range: colOf(i),
          cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      });
    } else {
      requests.push({
        setDataValidation: {
          range: colOf(i),
          rule: {
            condition: { type: "ONE_OF_LIST", values: (c.options ?? []).map((o) => ({ userEnteredValue: o })) },
            strict: true, showCustomUi: true,
          },
        },
      });
    }
  });

  // Beautify: freeze baris 1-3 (filter + header), header bold + warna, CF
  requests.push({
    updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 3 } }, fields: "gridProperties.frozenRowCount" },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: header.length },
      cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 219 / 255, green: 234 / 255, blue: 254 / 255 } } },
      fields: "userEnteredFormat(textFormat,backgroundColor)",
    },
  });
  for (const rule of cfRules) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 3, startColumnIndex: 0, endColumnIndex: header.length }],
          booleanRule: {
            condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: rule.formula }] },
            format: { backgroundColor: { red: rule.color.r / 255, green: rule.color.g / 255, blue: rule.color.b / 255 } },
          },
        },
        index: 0,
      },
    });
  }
  await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, { requests });

  // Lebar kolom agar nama User/Site tidak terpotong
  if (widths?.length) {
    await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      requests: [{
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: widths.length },
          properties: { pixelSize: 90 },
          fields: "pixelSize",
        },
      }],
    });
    await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      requests: widths.map((w, i) => ({
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
          properties: { pixelSize: w },
          fields: "pixelSize",
        },
      })),
    });
  }
}

type LayoutWidths = number[];

// Tulis tab data tersembunyi (sumber FILTER) — header + semua baris
async function writeDataTab(tabName: string, oldSheetId: number | undefined, header: string[], rows: string[][], hidden = true): Promise<number> {
  let sheetId = oldSheetId;
  if (sheetId === undefined) {
    const addRes = await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      requests: [{ addSheet: { properties: { title: tabName, hidden } } }],
    });
    sheetId = addRes.replies?.[0]?.addSheet?.properties?.sheetId;
    if (sheetId === undefined) throw new Error(`Tab ${tabName} tidak bisa dibuat`);
  } else {
    sheetId = await resetTab(tabName, sheetId, hidden);
  }
  await putValues(tabName, "A1", [header, ...rows], "RAW");
  return sheetId;
}

async function handleSync(supabase: any, _unused: null): Promise<Response> {
  try {
    const sheetIds = await getSheetIdMap();
    let attSheetId = sheetIds["Absensi"];
    let cpSheetId = sheetIds["Checkpoint"];
    if (attSheetId === undefined || cpSheetId === undefined) {
      throw new Error("Tab 'Absensi' atau 'Checkpoint' tidak ditemukan di spreadsheet");
    }

    const nowIso = new Date().toISOString();

    // ===== Data mentah =====
    const { data: att } = await supabase
      .from("attendance_logs")
      .select("*, users(name, role), sites(name)")
      .order("timestamp", { ascending: true })
      .limit(MAX_ROWS);
    const { data: sites } = await supabase.from("sites").select("id, name, start_time");
    const startTimes: Record<string, string> = {};
    const siteNames: Record<string, string> = {};
    for (const s of sites || []) { startTimes[s.id] = s.start_time || "08:00"; siteNames[s.id] = s.name; }
    const { data: allUsers } = await supabase.from("users").select("id, name, role");
    const { data: cp } = await supabase
      .from("checkpoint_logs")
      .select("*, users(name), checkpoints(name, type), sites(name)")
      .order("created_at", { ascending: true })
      .limit(MAX_ROWS);

    const attRows = pairEvents(att || [], startTimes);
    const attHeader = ["Tanggal", "User", "Site", "Jenis", "Masuk", "Keluar", "Durasi (mnt)", "Terlambat", "Flag/Alasan", "Foto"];

    const cpHeader = ["Tanggal", "User", "Site", "Checkpoint", "Jenis", "Status", "Durasi (mnt)", "Sebelum", "Sesudah", "Catatan"];
    const statusLabel: Record<string, string> = { completed: "Selesai", in_progress: "Berjalan", expired: "Kedaluwarsa" };
    const cpRows = (cp || []).map((r: any) => [
      new Date(r.created_at).toISOString().slice(0, 10),
      r.users?.name ?? "-", r.sites?.name ?? "-",
      r.checkpoints?.name ?? "-", r.checkpoints?.type ?? "-",
      statusLabel[r.status] ?? r.status, String(r.duration_minutes ?? ""),
      r.before_photo_url ?? "", r.after_photo_url ?? "",
      r.inspection_note ?? r.note ?? "",
    ]);

    const recapHeader = ["Tanggal", "User", "Peran", "Jam Kerja", "Istirahat", "Perjalanan", "Terlambat", "Status"];
    const recapRows = buildDailyRecap(att || [], startTimes, siteNames, allUsers || []);

    // ===== Tab data tersembunyi =====
    const dataAbs = await writeDataTab("DataAbsensi", sheetIds["DataAbsensi"], attHeader, attRows);
    const dataCp = await writeDataTab("DataCheckpoint", sheetIds["DataCheckpoint"], cpHeader, cpRows);
    const dataRecap = await writeDataTab("DataRekap", sheetIds["DataRekap"], [...recapHeader, "Sites"], recapRows);

    const userOptions = ["Semua", ...(allUsers || []).map((u: any) => u.name)];
    const siteOptions = ["Semua", ...(sites || []).map((s: any) => s.name)];

    // ===== Tab Absensi (layout web log) =====
    attSheetId = await resetTab("Absensi", attSheetId);
    await writeWebLogLayout(
      attSheetId, "Absensi", "DataAbsensi", attHeader,
      [
        { label: "Dari", kind: "date" },
        { label: "Sampai", kind: "date" },
        { label: "Site", kind: "dropdown", options: siteOptions },
        { label: "User", kind: "dropdown", options: userOptions },
        { label: "Tipe", kind: "dropdown", options: ["Semua", "Kerja", "Istirahat"] },
        { label: "Flag", kind: "dropdown", options: ["Semua", "Ya", "Tidak"] },
      ],
      `=IFERROR(FILTER('DataAbsensi'!A2:J,` +
        `(IF($B$1="",'DataAbsensi'!A2:A<>"",DATEVALUE('DataAbsensi'!A2:A)>=$B$1))*` +
        `(IF($D$1="",'DataAbsensi'!A2:A<>"",DATEVALUE('DataAbsensi'!A2:A)<=$D$1))*` +
        `(IF($F$1="Semua",'DataAbsensi'!A2:A<>"",'DataAbsensi'!C2:C=$F$1))*` +
        `(IF($H$1="Semua",'DataAbsensi'!A2:A<>"",'DataAbsensi'!B2:B=$H$1))*` +
        `(IF($J$1="Semua",'DataAbsensi'!A2:A<>"",'DataAbsensi'!D2:D=$J$1))*` +
        `(IF($L$1="Semua",'DataAbsensi'!A2:A<>"",IF($L$1="Ya",LEFT('DataAbsensi'!I2:I,2)="Ya",'DataAbsensi'!I2:I="")))),"")`,
      [
        { startCol: 7, formula: `=$H4="Ya"`, color: { r: 242, g: 217, b: 217 } },
        { startCol: 8, formula: `=$I4<>""`, color: { r: 252, g: 242, b: 204 } },
        { startCol: 3, formula: `=$D4="Istirahat"`, color: { r: 237, g: 237, b: 237 } },
      ],
      [90, 150, 150, 90, 160, 160, 110, 110, 130, 90],
    );

    // ===== Tab Checkpoint (layout web log) =====
    cpSheetId = await resetTab("Checkpoint", cpSheetId);
    await writeWebLogLayout(
      cpSheetId, "Checkpoint", "DataCheckpoint", cpHeader,
      [
        { label: "Dari", kind: "date" },
        { label: "Sampai", kind: "date" },
        { label: "Site", kind: "dropdown", options: siteOptions },
        { label: "User", kind: "dropdown", options: userOptions },
        { label: "Checkpoint", kind: "dropdown", options: ["Semua", ...new Set(cpRows.map((r) => r[3]).filter(Boolean))] },
        { label: "Status", kind: "dropdown", options: ["Semua", "Selesai", "Berjalan", "Kedaluwarsa"] },
      ],
      `=IFERROR(FILTER('DataCheckpoint'!A2:J,` +
        `(IF($B$1="",'DataCheckpoint'!A2:A<>"",DATEVALUE('DataCheckpoint'!A2:A)>=$B$1))*` +
        `(IF($D$1="",'DataCheckpoint'!A2:A<>"",DATEVALUE('DataCheckpoint'!A2:A)<=$D$1))*` +
        `(IF($F$1="Semua",'DataCheckpoint'!A2:A<>"",'DataCheckpoint'!C2:C=$F$1))*` +
        `(IF($H$1="Semua",'DataCheckpoint'!A2:A<>"",'DataCheckpoint'!B2:B=$H$1))*` +
        `(IF($J$1="Semua",'DataCheckpoint'!A2:A<>"",'DataCheckpoint'!D2:D=$J$1))*` +
        `(IF($L$1="Semua",'DataCheckpoint'!A2:A<>"",'DataCheckpoint'!F2:F=$L$1))),"")`,
      [
        { startCol: 5, formula: `=$F4="Selesai"`, color: { r: 220, g: 252, b: 231 } },
        { startCol: 5, formula: `=$F4="Berjalan"`, color: { r: 254, g: 243, b: 199 } },
        { startCol: 5, formula: `=$F4="Kedaluwarsa"`, color: { r: 254, g: 226, b: 226 } },
      ],
      [90, 150, 150, 190, 90, 120, 110, 150, 150, 170],
    );

    // ===== Tab Rekap Harian (layout web log) =====
    let recapSheetId = sheetIds["Rekap Harian"];
    if (recapSheetId === undefined) {
      const addRes = await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
        requests: [{ addSheet: { properties: { title: "Rekap Harian" } } }],
      });
      recapSheetId = addRes.replies?.[0]?.addSheet?.properties?.sheetId;
    }
    if (recapSheetId !== undefined) {
      recapSheetId = await resetTab("Rekap Harian", recapSheetId);
      await writeWebLogLayout(
        recapSheetId, "Rekap Harian", "DataRekap", recapHeader,
        [
          { label: "Dari", kind: "date" },
          { label: "Sampai", kind: "date" },
          { label: "Site", kind: "dropdown", options: siteOptions },
          { label: "User", kind: "dropdown", options: userOptions },
        ],
        `=IFERROR(FILTER('DataRekap'!A2:H,` +
          `(IF($B$1="",'DataRekap'!A2:A<>"",DATEVALUE('DataRekap'!A2:A)>=$B$1))*` +
          `(IF($D$1="",'DataRekap'!A2:A<>"",DATEVALUE('DataRekap'!A2:A)<=$D$1))*` +
          `(IF($F$1="Semua",'DataRekap'!A2:A<>"",ISNUMBER(SEARCH("|"&$F$1&"|","|"&'DataRekap'!I2:I&"|"))))*` +
          `(IF($H$1="Semua",'DataRekap'!A2:A<>"",'DataRekap'!B2:B=$H$1))),"")`,
        [
          { startCol: 6, formula: `=$G4="Ya"`, color: { r: 242, g: 217, b: 217 } },
          { startCol: 7, formula: `=$H4="Absen"`, color: { r: 254, g: 226, b: 226 } },
        ],
      );
    }

    // Marker tetap di-update — hanya untuk log (tidak dipakai untuk incremental lagi)
    await supabase.from("app_config").upsert({ key: SYNC_MARKER_ATT, value: nowIso, updated_at: nowIso });
    await supabase.from("app_config").upsert({ key: SYNC_MARKER_CP, value: nowIso, updated_at: nowIso });

    return new Response(JSON.stringify({
      synced: { attendance: attRows.length, checkpoint: cpRows.length, recap: recapRows.length },
      mode: "full_rebuild_web_log_layout",
      marker: nowIso,
    }), { headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e).slice(0, 300) }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
