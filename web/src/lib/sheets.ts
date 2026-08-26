"use server";

// Tombol "Sync ke Google Sheets" di halaman Log → memanggil edge function
// sync-sheets (sumber logika tunggal: pairing, Terlambat, header-once, beautify).
// Auth: dikirim Bearer JWT admin; edge memvalidasi role.

import { createClient } from "@/lib/supabase/server";

const EDGE_URL = "https://vbzbyxmcpwppvfpbxsls.supabase.co/functions/v1/sync-sheets";

export async function syncToSheets(): Promise<string> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sesi tidak ditemukan. Login ulang.");

  const res = await fetch(EDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: "{}",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Sinkron gagal (${res.status})`);
  }
  return `Sinkron selesai — ${data.synced.attendance} baris absensi, ${data.synced.checkpoint} baris checkpoint ditulis ke Google Sheets.`;
}
