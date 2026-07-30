"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/admin/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ColumnDef } from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { Download } from "lucide-react";

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
      <span className={row.original.type === "check_in" ? "text-green-600" : "text-red-600"}>
        {row.original.type === "check_in" ? "Masuk" : "Keluar"}
      </span>
    ),
  },
  {
    accessorKey: "timestamp",
    header: "Waktu",
    cell: ({ row }) => new Date(row.original.timestamp).toLocaleString("id-ID"),
  },
  { accessorKey: "distance", header: "Jarak (m)" },
  {
    accessorKey: "flagged",
    header: "Override",
    cell: ({ row }) => (row.original.flagged ? row.original.reason : "-"),
  },
];

export function AttendanceTable() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ site: "", type: "", date: "", flagged: "" });
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("attendance_logs")
      .select("id, user_id, site_id, type, timestamp, distance_meters, is_flagged, override_reason, users(name), sites(name)")
      .order("timestamp", { ascending: false })
      .limit(200);

    if (filters.site) query = query.eq("site_id", filters.site);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.date) {
      query = query.gte("timestamp", filters.date + "T00:00:00Z");
      query = query.lt("timestamp", filters.date + "T23:59:59Z");
    }
    if (filters.flagged === "true") query = query.eq("is_flagged", true);
    if (filters.flagged === "false") query = query.eq("is_flagged", false);

    const { data } = await query;
    setRows(
      (data || []).map((r: any) => ({
        id: r.id,
        userName: r.users?.name || "?",
        siteName: r.sites?.name || "?",
        type: r.type,
        timestamp: r.timestamp,
        distance: r.distance_meters,
        flagged: r.is_flagged,
        reason: r.override_reason,
      }))
    );
    setLoading(false);
  }, [filters, supabase]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const exportCSV = () => {
    const header = "Cleaner,Site,Tipe,Waktu,Jarak (m),Override,Alasan";
    const body = rows
      .map((r) => `"${r.userName}","${r.siteName}",${r.type === "check_in" ? "Masuk" : "Keluar"},${r.timestamp},${r.distance},${r.flagged ? "Ya" : "Tidak"},"${r.reason || ""}"`)
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Log Absensi</CardTitle>
        <Button size="sm" variant="outline" onClick={exportCSV}>
          <Download className="mr-1 h-3 w-3" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-4 gap-2">
          <div>
            <Label className="text-xs">Tipe</Label>
            <Select value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v === "all" || !v ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="check_in">Check-in</SelectItem>
                <SelectItem value="check_out">Check-out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Override</Label>
            <Select value={filters.flagged} onValueChange={(v) => setFilters((f) => ({ ...f, flagged: v === "all" || !v ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="true">Override</SelectItem>
                <SelectItem value="false">Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tanggal</Label>
            <Input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={() => setFilters({ site: "", type: "", date: "", flagged: "" })}>Reset</Button>
          </div>
        </div>
        {loading ? <p className="text-center text-sm text-gray-400">Memuat...</p> : <DataTable columns={attendanceColumns} data={rows} />}
      </CardContent>
    </Card>
  );
}
