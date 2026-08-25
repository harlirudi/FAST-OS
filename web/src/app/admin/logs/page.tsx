"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { appendToSheet } from "@/lib/sheets";
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

type Site = { id: string; name: string };
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
    supabase.from("sites").select("id, name").order("name").then(({ data }) => setSites(data || []));
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

  const exportToSheets = async () => {
    setExporting(true);
    try {
      // Fetch semua baris sesuai filter (maks 5000) untuk export
      const maxRows = 5000;
      let header: string[];
      let body: string[][];
      if (tab === "attendance") {
        let q = supabase
          .from("attendance_logs")
          .select("*, users(name), sites(name)")
          .gte("timestamp", `${dateFrom}T00:00:00`)
          .lte("timestamp", `${dateTo}T23:59:59`)
          .order("timestamp", { ascending: false })
          .limit(maxRows);
        if (siteId !== "all") q = q.eq("site_id", siteId);
        if (userId !== "all") q = q.eq("user_id", userId);
        if (attType !== "all") q = q.eq("type", attType);
        if (attFlagged === "yes") q = q.eq("is_flagged", true);
        if (attFlagged === "no") q = q.eq("is_flagged", false);
        const { data } = await q;
        header = ["Diekspor", "Waktu", "User", "Site", "Tipe", "Jarak (m)", "Flag", "Alasan", "Foto"];
        body = (data || []).map((r: any) => [
          new Date().toLocaleString("id-ID"),
          new Date(r.timestamp).toLocaleString("id-ID"),
          r.users?.name ?? "-", r.sites?.name ?? "-",
          r.type, String(r.distance_meters ?? ""),
          r.is_flagged ? "Ya" : "Tidak", r.override_reason ?? "-",
          r.check_in_photo_url || r.check_out_photo_url || "",
        ]);
        await appendToSheet("Absensi!A1", [header, ...body]);
      } else {
        let q = supabase
          .from("checkpoint_logs")
          .select("*, users(name), checkpoints(name, type), sites(name)")
          .gte("created_at", `${dateFrom}T00:00:00`)
          .lte("created_at", `${dateTo}T23:59:59`)
          .order("created_at", { ascending: false })
          .limit(maxRows);
        if (siteId !== "all") q = q.eq("site_id", siteId);
        if (userId !== "all") q = q.eq("user_id", userId);
        if (cpId !== "all") q = q.eq("checkpoint_id", cpId);
        if (cpStatus !== "all") q = q.eq("status", cpStatus);
        const { data } = await q;
        header = ["Diekspor", "Waktu", "User", "Site", "Checkpoint", "Jenis", "Status", "Durasi (mnt)", "Sebelum", "Sesudah", "Catatan"];
        body = (data || []).map((r: any) => [
          new Date().toLocaleString("id-ID"),
          new Date(r.created_at).toLocaleString("id-ID"),
          r.users?.name ?? "-", r.sites?.name ?? "-",
          r.checkpoints?.name ?? "-", r.checkpoints?.type ?? "-",
          r.status, String(r.duration_minutes ?? ""),
          r.before_photo_url ?? "", r.after_photo_url ?? "",
          r.inspection_note ?? r.note ?? "",
        ]);
        await appendToSheet("Checkpoint!A1", [header, ...body]);
      }
      alert(
        `Berhasil ditulis ke Google Sheets (${body.length} baris) — tab "${tab === "attendance" ? "Absensi" : "Checkpoint"}".\nDokumentasi tersimpan di spreadsheet yang sudah di-share.`
      );
    } catch (e: any) {
      alert(`Gagal export ke Google Sheets: ${e?.message || "terjadi kesalahan"}`);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Log</h2>
        <Button variant="outline" size="sm" type="button" onClick={exportToSheets} disabled={exporting}>
          <Download className="mr-1 h-3.5 w-3.5" />
          {exporting ? "Mengekspor..." : "Export ke Google Sheets"}
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
        ) : tab === "attendance" ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Waktu</th>
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 font-semibold">Site</th>
                <th className="px-3 py-2 font-semibold">Tipe</th>
                <th className="px-3 py-2 font-semibold">Jarak</th>
                <th className="px-3 py-2 font-semibold">Flag</th>
                <th className="px-3 py-2 font-semibold">Foto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-slate-50/70">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.timestamp).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2">{r.users?.name ?? "-"}</td>
                  <td className="px-3 py-2">{r.sites?.name ?? "-"}</td>
                  <td className="px-3 py-2">{r.type === "check_in" ? "Check-in" : "Check-out"}</td>
                  <td className="px-3 py-2">{r.distance_meters != null ? `${r.distance_meters}m` : "-"}</td>
                  <td className="px-3 py-2">
                    {r.is_flagged ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800" title={r.override_reason || ""}>
                        Ya{r.override_reason ? ` · ${r.override_reason.slice(0, 30)}` : ""}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <PhotoThumb url={r.check_in_photo_url || r.check_out_photo_url} alt={`Foto ${r.type} — ${r.users?.name ?? ""}`} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-sm text-gray-400">Tidak ada data untuk filter ini.</td></tr>
              )}
            </tbody>
          </table>
        ) : (
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
