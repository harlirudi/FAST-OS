"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/admin/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFilterableTable } from "./use-filterable-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, RefreshCw, Eye } from "lucide-react";

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

const PhotoCell = ({ url, label }: { url: string | null; label: string }) => {
  const [open, setOpen] = useState(false);
  if (!url || url.includes("placehold")) {
    return <span className="text-xs text-slate-400">-</span>;
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50"
        onClick={() => setOpen(true)}
      >
        <Eye className="h-3 w-3" />
        Lihat
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl overflow-hidden p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-base font-semibold">{label}</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg border bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className="h-auto max-h-[70vh] w-full object-contain" />
          </div>
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
      const config: Record<string, { label: string; className: string }> = {
        completed: {
          label: "Selesai",
          className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        },
        in_progress: {
          label: "Berjalan",
          className: "bg-blue-50 text-blue-700 border-blue-200",
        },
        expired: {
          label: "Kedaluwarsa",
          className: "bg-rose-50 text-rose-700 border-rose-200",
        },
      };
      const current = config[s] || {
        label: s,
        className: "bg-slate-50 text-slate-700 border-slate-200",
      };
      return (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${current.className}`}
        >
          {current.label}
        </span>
      );
    },
  },
  {
    accessorKey: "logType",
    header: "Tipe",
    cell: ({ row }) => (
      <span className="text-xs font-medium text-slate-600">
        {row.original.logType === "inspection" ? "Inspeksi" : "Cleaning"}
      </span>
    ),
  },
  {
    accessorKey: "startedAt",
    header: "Mulai",
    cell: ({ row }) =>
      row.original.startedAt ? new Date(row.original.startedAt).toLocaleString("id-ID") : "-",
  },
  {
    accessorKey: "duration",
    header: "Durasi",
    cell: ({ row }) => (row.original.duration != null ? `${row.original.duration} menit` : "-"),
  },
  {
    accessorKey: "beforePhotoUrl",
    header: "Foto Sebelum",
    cell: ({ row }) => (
      <PhotoCell
        url={row.original.beforePhotoUrl}
        label={`Foto Sebelum - ${row.original.checkpointName}`}
      />
    ),
  },
  {
    accessorKey: "afterPhotoUrl",
    header: "Foto Sesudah",
    cell: ({ row }) => (
      <PhotoCell
        url={row.original.afterPhotoUrl}
        label={`Foto Sesudah - ${row.original.checkpointName}`}
      />
    ),
  },
];

export function CheckpointTable() {
  const { rows, loading, filters, setFilters, exportCSV, refresh } = useFilterableTable(
    "checkpoint",
    async (supabase, f) => {
      let q = supabase
        .from("checkpoint_logs")
        .select(
          "id, checkpoint_id, site_id, user_id, status, log_type, started_at, duration_minutes, before_photo_url, after_photo_url, checkpoints(name), sites(name), users(name)"
        )
        .order("started_at", { ascending: false })
        .limit(200);

      if (f.status) q = q.eq("status", f.status);
      if (f.date) {
        q = q.gte("started_at", f.date + "T00:00:00Z");
        q = q.lt("started_at", f.date + "T23:59:59Z");
      }

      const { data } = await q;
      return (data || []).map((r: any) => ({
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
      }));
    },
    { status: "", date: "" }
  );

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg font-bold text-slate-800">Log Checkpoint</CardTitle>
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
                ["Checkpoint", "Site", "Cleaner", "Status", "Tipe", "Mulai", "Durasi (menit)"],
                (r) =>
                  `"${r.checkpointName}","${r.siteName}","${r.userName}",${r.status},${
                    r.logType === "inspection" ? "Inspeksi" : "Cleaning"
                  },"${r.startedAt}",${r.duration ?? ""}`,
                "checkpoint_logs.csv"
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
            <Label className="text-xs text-slate-600">Status</Label>
            <Select
              value={filters.status || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, status: v === "all" || !v ? "" : v }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
                <SelectItem value="in_progress">Sedang Berjalan</SelectItem>
                <SelectItem value="expired">Kedaluwarsa</SelectItem>
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
              onClick={() => setFilters({ status: "", date: "" })}
            >
              Reset Filter
            </Button>
          </div>
        </div>

        <DataTable columns={columns} data={rows} isLoading={loading} skeletonRowCount={5} />
      </CardContent>
    </Card>
  );
}
