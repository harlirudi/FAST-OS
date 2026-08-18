"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/admin/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFilterableTable } from "./use-filterable-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";

type AttendanceRow = {
  id: string; userName: string; siteName: string; type: string;
  timestamp: string; distance: number; flagged: boolean; reason: string | null;
};

const attendanceColumns: ColumnDef<AttendanceRow>[] = [
  { accessorKey: "userName", header: "Cleaner" },
  { accessorKey: "siteName", header: "Site" },
  { accessorKey: "type", header: "Tipe", cell: ({ row }) => (
    <span className={row.original.type === "check_in" ? "text-green-600" : "text-red-600"}>
      {row.original.type === "check_in" ? "Masuk" : "Keluar"}
    </span>
  )},
  { accessorKey: "timestamp", header: "Waktu", cell: ({ row }) => new Date(row.original.timestamp).toLocaleString("id-ID") },
  { accessorKey: "distance", header: "Jarak (m)" },
  { accessorKey: "flagged", header: "Override", cell: ({ row }) => row.original.flagged ? row.original.reason : "-" },
];

export function AttendanceTable() {
  const { rows, loading, filters, setFilters, exportCSV } = useFilterableTable(
    "attendance",
    async (supabase, f) => {
      let q = supabase.from("attendance_logs")
        .select("id, user_id, site_id, type, timestamp, distance_meters, is_flagged, override_reason, users(name), sites(name)")
        .order("timestamp", { ascending: false }).limit(200);
      if (f.type) q = q.eq("type", f.type);
      if (f.date) { q = q.gte("timestamp", f.date + "T00:00:00Z"); q = q.lt("timestamp", f.date + "T23:59:59Z"); }
      if (f.flagged === "true") q = q.eq("is_flagged", true);
      if (f.flagged === "false") q = q.eq("is_flagged", false);
      const { data } = await q;
      return (data || []).map((r: any) => ({
        id: r.id, userName: r.users?.name || "?", siteName: r.sites?.name || "?",
        type: r.type, timestamp: r.timestamp, distance: r.distance_meters,
        flagged: r.is_flagged, reason: r.override_reason,
      }));
    },
    { type: "", flagged: "", date: "" }
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Log Absensi</CardTitle>
        <Button size="sm" variant="outline" onClick={() => exportCSV(["Cleaner","Site","Tipe","Waktu","Jarak","Override","Alasan"], r => `"${r.userName}","${r.siteName}",${r.type==="check_in"?"Masuk":"Keluar"},${r.timestamp},${r.distance},${r.flagged?"Ya":"Tidak"},"${r.reason||""}"`, "attendance.csv")}>
          <Download className="mr-1 h-3 w-3" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="mb-4 grid grid-cols-4 gap-2">
          <div><Label className="text-xs">Tipe</Label>
            <Select value={filters.type} onValueChange={(v) => setFilters({...filters, type: v === "all" || !v ? "" : v})}>
              <SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem><SelectItem value="check_in">Check-in</SelectItem><SelectItem value="check_out">Check-out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Override</Label>
            <Select value={filters.flagged} onValueChange={(v) => setFilters({...filters, flagged: v === "all" || !v ? "" : v})}>
              <SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem><SelectItem value="true">Override</SelectItem><SelectItem value="false">Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Tanggal</Label>
            <Input type="date" value={filters.date} onChange={(e) => setFilters({...filters, date: e.target.value})} />
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={() => setFilters({ type: "", flagged: "", date: "" })}>Reset</Button>
          </div>
        </div>
        <div className="min-h-[120px]">
          {loading ? <p className="pt-8 text-center text-sm text-gray-400">Memuat...</p> : <DataTable columns={attendanceColumns} data={rows} />}
        </div>
      </CardContent>
    </Card>
  );
}
