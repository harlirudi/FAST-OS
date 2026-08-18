"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/admin/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFilterableTable } from "./use-filterable-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, RefreshCw } from "lucide-react";

type AttendanceRow = {
  id: string;
  userName: string;
  siteName: string;
  type: string;
  timestamp: string;
  distance: number;
  flagged: boolean;
  reason: string | null;
};

const attendanceColumns: ColumnDef<AttendanceRow>[] = [
  { accessorKey: "userName", header: "Cleaner" },
  { accessorKey: "siteName", header: "Site" },
  {
    accessorKey: "type",
    header: "Tipe",
    cell: ({ row }) => (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
          row.original.type === "check_in"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-rose-50 text-rose-700 border border-rose-200"
        }`}
      >
        {row.original.type === "check_in" ? "Masuk" : "Keluar"}
      </span>
    ),
  },
  {
    accessorKey: "timestamp",
    header: "Waktu",
    cell: ({ row }) =>
      row.original.timestamp ? new Date(row.original.timestamp).toLocaleString("id-ID") : "-",
  },
  {
    accessorKey: "distance",
    header: "Jarak (m)",
    cell: ({ row }) => (row.original.distance != null ? `${row.original.distance} m` : "-"),
  },
  {
    accessorKey: "flagged",
    header: "Override",
    cell: ({ row }) =>
      row.original.flagged ? (
        <span className="text-xs text-amber-600 font-medium">{row.original.reason || "Ya"}</span>
      ) : (
        <span className="text-xs text-slate-400">-</span>
      ),
  },
];

export function AttendanceTable() {
  const { rows, loading, filters, setFilters, exportCSV, refresh } = useFilterableTable(
    "attendance",
    async (supabase, f) => {
      let q = supabase
        .from("attendance_logs")
        .select(
          "id, user_id, site_id, type, timestamp, distance_meters, is_flagged, override_reason, users(name), sites(name)"
        )
        .order("timestamp", { ascending: false })
        .limit(200);

      if (f.type) q = q.eq("type", f.type);
      if (f.date) {
        q = q.gte("timestamp", f.date + "T00:00:00Z");
        q = q.lt("timestamp", f.date + "T23:59:59Z");
      }
      if (f.flagged === "true") q = q.eq("is_flagged", true);
      if (f.flagged === "false") q = q.eq("is_flagged", false);

      const { data } = await q;
      return (data || []).map((r: any) => ({
        id: r.id,
        userName: r.users?.name || "?",
        siteName: r.sites?.name || "?",
        type: r.type,
        timestamp: r.timestamp,
        distance: r.distance_meters,
        flagged: r.is_flagged,
        reason: r.override_reason,
      }));
    },
    { type: "", flagged: "", date: "" }
  );

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg font-bold text-slate-800">Log Absensi</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={refresh}
            title="Muat ulang data"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportCSV(
                ["Cleaner", "Site", "Tipe", "Waktu", "Jarak (m)", "Override", "Alasan"],
                (r) =>
                  `"${r.userName}","${r.siteName}",${r.type === "check_in" ? "Masuk" : "Keluar"},"${r.timestamp}",${r.distance},${r.flagged ? "Ya" : "Tidak"},"${r.reason || ""}"`,
                "attendance.csv"
              )
            }
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Unduh CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs text-slate-600">Tipe</Label>
            <Select
              value={filters.type || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, type: v === "all" || !v ? "" : v }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="check_in">Masuk (Check-in)</SelectItem>
                <SelectItem value="check_out">Keluar (Check-out)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-600">Status Override</Label>
            <Select
              value={filters.flagged || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, flagged: v === "all" || !v ? "" : v }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="true">Ada Override</SelectItem>
                <SelectItem value="false">Normal (Tanpa Override)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-600">Tanggal</Label>
            <Input
              type="date"
              className="h-9"
              value={filters.date || ""}
              onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
            />
          </div>

          <div className="flex items-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-full border border-dashed border-slate-300 text-slate-600 hover:bg-slate-100"
              onClick={() => setFilters({ type: "", flagged: "", date: "" })}
            >
              Reset Filter
            </Button>
          </div>
        </div>

        <DataTable
          columns={attendanceColumns}
          data={rows}
          isLoading={loading}
          skeletonRowCount={5}
        />
      </CardContent>
    </Card>
  );
}
