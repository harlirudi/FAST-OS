"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/admin/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ColumnDef } from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { Download } from "lucide-react";

type CheckpointRow = {
  id: string;
  checkpointName: string;
  siteName: string;
  userName: string;
  status: string;
  logType: string;
  startedAt: string;
  duration: number | null;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
};

const PhotoCell = ({ url }: { url: string | null }) => {
  const [open, setOpen] = useState(false);
  if (!url || url.includes("placehold")) return <span className="text-xs text-gray-400">-</span>;
  return (
    <>
      <img src={url} alt="" className="h-16 w-20 cursor-pointer rounded border object-cover" onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <img src={url} alt="" className="w-full rounded" />
        </DialogContent>
      </Dialog>
    </>
  );
};

const columns: ColumnDef<CheckpointRow>[] = [
  { accessorKey: "checkpointName", header: "Checkpoint" },
  { accessorKey: "siteName", header: "Site" },
  { accessorKey: "userName", header: "Cleaner" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status;
      const c = s === "completed" ? "text-green-600" : s === "in_progress" ? "text-blue-600" : "text-red-600";
      const l = s === "completed" ? "Selesai" : s === "in_progress" ? "Berjalan" : "Kedaluwarsa";
      return <span className={c}>{l}</span>;
    },
  },
  {
    accessorKey: "logType",
    header: "Tipe",
    cell: ({ row }) => (row.original.logType === "inspection" ? "Inspeksi" : "Cleaning"),
  },
  {
    accessorKey: "startedAt",
    header: "Mulai",
    cell: ({ row }) => new Date(row.original.startedAt).toLocaleString("id-ID"),
  },
  {
    accessorKey: "duration",
    header: "Durasi",
    cell: ({ row }) => (row.original.duration != null ? `${row.original.duration} menit` : "-"),
  },
  {
    accessorKey: "beforePhotoUrl",
    header: "Foto Before",
    cell: ({ row }) => <PhotoCell url={row.original.beforePhotoUrl} />,
  },
  {
    accessorKey: "afterPhotoUrl",
    header: "Foto After",
    cell: ({ row }) => <PhotoCell url={row.original.afterPhotoUrl} />,
  },
];

export function CheckpointTable() {
  const [rows, setRows] = useState<CheckpointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ site: "", status: "", date: "" });
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("checkpoint_logs")
      .select("id, checkpoint_id, site_id, user_id, status, log_type, started_at, duration_minutes, before_photo_url, after_photo_url, checkpoints(name), sites(name), users(name)")
      .order("started_at", { ascending: false })
      .limit(200);

    if (filters.site) query = query.eq("site_id", filters.site);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.date) {
      query = query.gte("started_at", filters.date + "T00:00:00Z");
      query = query.lt("started_at", filters.date + "T23:59:59Z");
    }

    const { data } = await query;
    setRows(
      (data || []).map((r: any) => ({
        id: r.id,
        checkpointName: r.checkpoints?.name || "?",
        siteName: r.sites?.name || "?",
        userName: r.users?.name || "?",
        status: r.status,
        logType: r.log_type,
        startedAt: r.started_at,
        duration: r.duration_minutes,
        beforePhotoUrl: r.before_photo_url,
        afterPhotoUrl: r.after_photo_url,
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
    const header = "Checkpoint,Site,Cleaner,Status,Tipe,Mulai,Durasi (menit)";
    const body = rows
      .map((r) => `"${r.checkpointName}","${r.siteName}","${r.userName}",${r.status},${r.logType === "inspection" ? "Inspeksi" : "Cleaning"},${r.startedAt},${r.duration ?? ""}`)
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "checkpoint_logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Log Checkpoint</CardTitle>
        <Button size="sm" variant="outline" onClick={exportCSV}>
          <Download className="mr-1 h-3 w-3" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-4 gap-2">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" || !v ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
                <SelectItem value="in_progress">Berjalan</SelectItem>
                <SelectItem value="expired">Kedaluwarsa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tanggal</Label>
            <Input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={() => setFilters({ site: "", status: "", date: "" })}>Reset</Button>
          </div>
        </div>
        {loading ? <p className="text-center text-sm text-gray-400">Memuat...</p> : <DataTable columns={columns} data={rows} />}
      </CardContent>
    </Card>
  );
}
