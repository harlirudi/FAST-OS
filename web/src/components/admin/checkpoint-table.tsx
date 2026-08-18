"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/admin/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFilterableTable } from "./use-filterable-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";

type CheckpointRow = {
  id: string; checkpointName: string; siteName: string; userName: string;
  status: string; logType: string; startedAt: string; duration: number | null;
  beforePhotoUrl: string | null; afterPhotoUrl: string | null;
};

const PhotoCell = ({ url }: { url: string | null }) => {
  const [open, setOpen] = useState(false);
  if (!url || url.includes("placehold")) return <span className="text-xs text-gray-400">-</span>;
  return (
    <>
      <span className="cursor-pointer text-xs text-blue-600 underline" onClick={() => setOpen(true)}>Lihat</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl"><img src={url} alt="" className="w-full rounded" /></DialogContent>
      </Dialog>
    </>
  );
};

const columns: ColumnDef<CheckpointRow>[] = [
  { accessorKey: "checkpointName", header: "Checkpoint" },
  { accessorKey: "siteName", header: "Site" },
  { accessorKey: "userName", header: "Cleaner" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => {
    const s = row.original.status;
    return <span className={s==="completed"?"text-green-600":s==="in_progress"?"text-blue-600":"text-red-600"}>{s==="completed"?"Selesai":s==="in_progress"?"Berjalan":"Kedaluwarsa"}</span>;
  }},
  { accessorKey: "logType", header: "Tipe", cell: ({ row }) => row.original.logType === "inspection" ? "Inspeksi" : "Cleaning" },
  { accessorKey: "startedAt", header: "Mulai", cell: ({ row }) => new Date(row.original.startedAt).toLocaleString("id-ID") },
  { accessorKey: "duration", header: "Durasi", cell: ({ row }) => row.original.duration != null ? `${row.original.duration} menit` : "-" },
  { accessorKey: "beforePhotoUrl", header: "Foto Before", cell: ({ row }) => <PhotoCell url={row.original.beforePhotoUrl} /> },
  { accessorKey: "afterPhotoUrl", header: "Foto After", cell: ({ row }) => <PhotoCell url={row.original.afterPhotoUrl} /> },
];

export function CheckpointTable() {
  const { rows, loading, filters, setFilters, exportCSV } = useFilterableTable(
    "checkpoint",
    async (supabase, f) => {
      let q = supabase.from("checkpoint_logs")
        .select("id, checkpoint_id, site_id, user_id, status, log_type, started_at, duration_minutes, before_photo_url, after_photo_url, checkpoints(name), sites(name), users(name)")
        .order("started_at", { ascending: false }).limit(200);
      if (f.status) q = q.eq("status", f.status);
      if (f.date) { q = q.gte("started_at", f.date + "T00:00:00Z"); q = q.lt("started_at", f.date + "T23:59:59Z"); }
      const { data } = await q;
      return (data || []).map((r: any) => ({
        id: r.id, checkpointName: r.checkpoints?.name || "?", siteName: r.sites?.name || "?",
        userName: r.users?.name || "?", status: r.status, logType: r.log_type,
        startedAt: r.started_at, duration: r.duration_minutes,
        beforePhotoUrl: r.before_photo_url, afterPhotoUrl: r.after_photo_url,
      }));
    },
    { status: "", date: "" }
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Log Checkpoint</CardTitle>
        <Button size="sm" variant="outline" onClick={() => exportCSV(["Checkpoint","Site","Cleaner","Status","Tipe","Mulai","Durasi"], r => `"${r.checkpointName}","${r.siteName}","${r.userName}",${r.status},${r.logType==="inspection"?"Inspeksi":"Cleaning"},${r.startedAt},${r.duration??""}`, "checkpoint_logs.csv")}>
          <Download className="mr-1 h-3 w-3" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="mb-4 grid grid-cols-4 gap-2">
          <div><Label className="text-xs">Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v === "all" || !v ? "" : v})}>
              <SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem><SelectItem value="completed">Selesai</SelectItem>
                <SelectItem value="in_progress">Berjalan</SelectItem><SelectItem value="expired">Kedaluwarsa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Tanggal</Label>
            <Input type="date" value={filters.date} onChange={(e) => setFilters({...filters, date: e.target.value})} />
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={() => setFilters({ status: "", date: "" })}>Reset</Button>
          </div>
        </div>
        <div className="min-h-[120px]">
          {loading ? <p className="pt-8 text-center text-sm text-gray-400">Memuat...</p> : <DataTable columns={columns} data={rows} />}
        </div>
      </CardContent>
    </Card>
  );
}
