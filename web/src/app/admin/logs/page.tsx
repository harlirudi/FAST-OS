"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { syncToSheets } from "@/lib/sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;

function FilterSelect({ value, onChange, options, placeholder = "Pilih..." }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <Select items={items} value={value || undefined} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

type Site = { id: string; name: string; start_time?: string | null };
type User = { id: string; name: string; role: string };

function PhotoThumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return <span className="text-xs text-gray-300">-</span>;
  return (
    <Dialog>
      <DialogTrigger>
        <img src={url} alt={alt} className="h-10 w-10 rounded border object-cover" />
      </DialogTrigger>
      <DialogContent showCloseButton>
        <DialogHeader><DialogTitle>{alt}</DialogTitle></DialogHeader>
        <img src={url} alt={alt} className="max-h-[70vh] w-full rounded object-contain" />
      </DialogContent>
    </Dialog>
  );
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => (c.includes(",") || c.includes('"') ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return csv;
}

async function copyToClipboard(csv: string) {
  try {
    await navigator.clipboard.writeText(csv);
    return true;
  } catch {
    return false;
  }
}


type AttBlock = {
  key: string; day: string; userName: string; siteName: string; siteId: string;
  kind: "Kerja" | "Istirahat";
  masuk: string; keluar: string | null;
  durasi: number | null;
  terlambat: boolean;
  flagged: boolean; reason: string; photo: string | null;
};

// Gabungkan event absensi jadi blok Kerja/Istirahat per user/site/hari (sama dengan sync sheets)
function pairAttendance(events: any[], startTimes: Record<string, string>): AttBlock[] {
  const byKey = new Map<string, any[]>();
  for (const e of events) {
    const day = new Date(e.timestamp).toISOString().slice(0, 10);
    const key = `${e.user_id}|${e.site_id}|${day}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(e);
  }
  const fmt = (ts: string) => new Date(ts).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const localHm = (ts: string) => {
    const d = new Date(ts);
    return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(11, 16);
  };
  const dur = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  const out: AttBlock[] = [];
  for (const [key, evts] of byKey) {
    const sorted = evts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const [userId, siteId, day] = key.split("|");
    const userName = sorted[0].users?.name ?? "-";
    const siteName = sorted[0].sites?.name ?? "-";
    const startTime = startTimes[siteId] || "08:00";
    let open: any = null;
    let openKind: "Kerja" | "Istirahat" | null = null;
    const close = (endEvt: any) => {
      if (!open) return;
      const kind = openKind === "Istirahat" ? "Istirahat" : "Kerja";
      const flagged = open.is_flagged || endEvt.is_flagged;
      out.push({
        key: `${open.id}-${endEvt.id}`, day, userName, siteName, siteId, kind,
        masuk: fmt(open.timestamp), keluar: fmt(endEvt.timestamp),
        durasi: dur(open.timestamp, endEvt.timestamp),
        terlambat: kind === "Kerja" && localHm(open.timestamp) > startTime,
        flagged,
        reason: (endEvt.override_reason || open.override_reason || ""),
        photo: flagged ? (open.check_in_photo_url || open.check_out_photo_url || endEvt.check_in_photo_url || endEvt.check_out_photo_url || null) : null,
      });
      open = null; openKind = null;
    };
    for (const ev of sorted) {
      if (ev.type === "break_start") { close(ev); open = ev; openKind = "Istirahat"; }
      else if (ev.type === "break_end" || ev.type === "check_in") { close(ev); open = ev; openKind = "Kerja"; }
      else if (ev.type === "check_out") { close(ev); }
    }
    if (open) {
      out.push({
        key: open.id, day, userName, siteName, siteId,
        kind: openKind === "Istirahat" ? "Istirahat" : "Kerja",
        masuk: fmt(open.timestamp), keluar: null, durasi: null,
        terlambat: openKind === "Kerja" && localHm(open.timestamp) > startTime,
        flagged: !!open.is_flagged, reason: open.override_reason || "",
        photo: open.is_flagged ? (open.check_in_photo_url || open.check_out_photo_url || null) : null,
      });
    }
  }
  return out;
}

export default function LogsPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<"attendance" | "checkpoint">("attendance");
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Filter umum
  const [siteId, setSiteId] = useState("all");
  const [userId, setUserId] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  // Filter absensi
  const [attType, setAttType] = useState("all");
  const [attFlagged, setAttFlagged] = useState("all");

  // Filter checkpoint
  const [cpId, setCpId] = useState("all");
  const [cpStatus, setCpStatus] = useState("all");
  const [checkpoints, setCheckpoints] = useState<{ id: string; name: string }[]>([]);

  // Data + pagination
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("sites").select("id, name, start_time").order("name").then(({ data }) => setSites(data || []));
    supabase.from("users").select("id, name, role").order("name").then(({ data }) => setUsers(data || []));
    supabase.from("checkpoints").select("id, name").order("display_order").then(({ data }) => setCheckpoints(data || []));
  }, [supabase]);

  useEffect(() => {
    setPage(0);
  }, [siteId, userId, dateFrom, dateTo, attType, attFlagged, cpId, cpStatus, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "attendance") {
        let q = supabase
          .from("attendance_logs")
          .select("*, users(name), sites(name)", { count: "exact" })
          .gte("timestamp", `${dateFrom}T00:00:00`)
          .lte("timestamp", `${dateTo}T23:59:59`)
          .order("timestamp", { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        if (siteId !== "all") q = q.eq("site_id", siteId);
        if (userId !== "all") q = q.eq("user_id", userId);
        if (attType !== "all") q = q.eq("type", attType);
        if (attFlagged === "yes") q = q.eq("is_flagged", true);
        if (attFlagged === "no") q = q.eq("is_flagged", false);
        const { data, count } = await q;
        setRows(data || []);
        setTotal(count ?? 0);
      } else {
        let q = supabase
          .from("checkpoint_logs")
          .select("*, users(name), checkpoints(name, type), sites(name)", { count: "exact" })
          .gte("created_at", `${dateFrom}T00:00:00`)
          .lte("created_at", `${dateTo}T23:59:59`)
          .order("created_at", { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        if (siteId !== "all") q = q.eq("site_id", siteId);
        if (userId !== "all") q = q.eq("user_id", userId);
        if (cpId !== "all") q = q.eq("checkpoint_id", cpId);
        if (cpStatus !== "all") q = q.eq("status", cpStatus);
        const { data, count } = await q;
        setRows(data || []);
        setTotal(count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, siteId, userId, dateFrom, dateTo, attType, attFlagged, cpId, cpStatus, page, supabase]);

  useEffect(() => { load(); }, [load]);

  const [exporting, setExporting] = useState(false);

  const syncNow = async () => {
    setExporting(true);
    try {
      const msg = await syncToSheets();
      alert(msg);
    } catch (e: any) {
      alert(`Gagal sinkron ke Google Sheets: ${e?.message || "terjadi kesalahan"}`);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Log</h2>
        <Button variant="outline" size="sm" type="button" onClick={syncNow} disabled={exporting}>
          <Download className="mr-1 h-3.5 w-3.5" />
          {exporting ? "Menyinkronkan..." : "Sync ke Google Sheets"}
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        {([["attendance", "Absensi"], ["checkpoint", "Checkpoint"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-t px-4 py-2 text-sm font-medium ${tab === k ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-800"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-white p-4 md:grid-cols-4 lg:grid-cols-6">
        <div>
          <Label>Dari</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>Sampai</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div>
          <Label>Site</Label>
          <FilterSelect value={siteId} onChange={setSiteId}
            options={[{ value: "all", label: "Semua" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
        </div>
        <div>
          <Label>User</Label>
          <FilterSelect value={userId} onChange={setUserId}
            options={[{ value: "all", label: "Semua" }, ...users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))]} />
        </div>
        {tab === "attendance" ? (
          <>
            <div>
              <Label>Tipe</Label>
              <FilterSelect value={attType} onChange={setAttType}
                options={[{ value: "all", label: "Semua" }, { value: "check_in", label: "Check-in" }, { value: "check_out", label: "Check-out" }]} />
            </div>
            <div>
              <Label>Flag</Label>
              <FilterSelect value={attFlagged} onChange={setAttFlagged}
                options={[{ value: "all", label: "Semua" }, { value: "yes", label: "Ya (di luar GPS)" }, { value: "no", label: "Tidak" }]} />
            </div>
          </>
        ) : (
          <>
            <div>
              <Label>Checkpoint</Label>
              <FilterSelect value={cpId} onChange={setCpId}
                options={[{ value: "all", label: "Semua" }, ...checkpoints.map((c) => ({ value: c.id, label: c.name }))]} />
            </div>
            <div>
              <Label>Status</Label>
              <FilterSelect value={cpStatus} onChange={setCpStatus}
                options={[{ value: "all", label: "Semua" }, { value: "completed", label: "Selesai" }, { value: "in_progress", label: "Berjalan" }, { value: "expired", label: "Kedaluwarsa" }]} />
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400">Memuat...</p>
        ) : tab === "attendance" ? (() => {
          const startTimes: Record<string, string> = {};
          for (const s of sites) startTimes[s.id] = s.start_time || "08:00";
          const blocks = pairAttendance(rows, startTimes);
          return (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Tanggal</th>
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 font-semibold">Site</th>
                <th className="px-3 py-2 font-semibold">Jenis</th>
                <th className="px-3 py-2 font-semibold">Masuk</th>
                <th className="px-3 py-2 font-semibold">Keluar</th>
                <th className="px-3 py-2 font-semibold">Durasi</th>
                <th className="px-3 py-2 font-semibold">Terlambat</th>
                <th className="px-3 py-2 font-semibold">Flag/Alasan</th>
                <th className="px-3 py-2 font-semibold">Foto</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.key} className="border-t hover:bg-slate-50/70">
                  <td className="px-3 py-2 whitespace-nowrap">{b.day}</td>
                  <td className="px-3 py-2">{b.userName}</td>
                  <td className="px-3 py-2">{b.siteName}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.kind === "Istirahat" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-800"}`}>
                      {b.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{b.masuk}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{b.keluar ?? "—"}</td>
                  <td className="px-3 py-2">{b.durasi != null ? `${b.durasi}m` : "—"}</td>
                  <td className="px-3 py-2">
                    {b.terlambat ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Terlambat</span>
                    ) : b.kind === "Kerja" ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Tepat</span>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {b.flagged ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800" title={b.reason}>
                        Ya{b.reason ? ` · ${b.reason.slice(0, 30)}` : ""}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <PhotoThumb url={b.photo} alt={`Foto — ${b.userName}`} />
                  </td>
                </tr>
              ))}
              {blocks.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-sm text-gray-400">Tidak ada data untuk filter ini.</td></tr>
              )}
            </tbody>
          </table>
          );
        })() : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Waktu</th>
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 font-semibold">Checkpoint</th>
                <th className="px-3 py-2 font-semibold">Jenis</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Durasi</th>
                <th className="px-3 py-2 font-semibold">Sebelum</th>
                <th className="px-3 py-2 font-semibold">Sesudah</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-slate-50/70">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2">{r.users?.name ?? "-"}</td>
                  <td className="px-3 py-2">{r.checkpoints?.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${r.checkpoints?.type === "security" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                      {r.checkpoints?.type ?? "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.status === "completed" ? "Selesai" : r.status === "in_progress" ? "Berjalan" : "Kedaluwarsa"}
                  </td>
                  <td className="px-3 py-2">{r.duration_minutes != null ? `${r.duration_minutes}m` : "-"}</td>
                  <td className="px-3 py-2"><PhotoThumb url={r.before_photo_url} alt={`Sebelum — ${r.checkpoints?.name ?? ""}`} /></td>
                  <td className="px-3 py-2"><PhotoThumb url={r.after_photo_url} alt={`Sesudah — ${r.checkpoints?.name ?? ""}`} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-sm text-gray-400">Tidak ada data untuk filter ini.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Halaman {page + 1} dari {totalPages} — {total} baris
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />Sebelumnya
          </Button>
          <Button variant="outline" size="sm" type="button" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            Berikutnya<ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
