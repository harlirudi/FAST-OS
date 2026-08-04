"use client";

export const dynamic = "force-dynamic";


import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/data-table";
import { FormSelect } from "@/components/admin/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { createCheckpoint, updateCheckpoint, deleteCheckpoint } from "@/lib/supabase/checkpoint-actions";
import { Pencil, Trash2, Plus, QrCode } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type Checkpoint = {
  id: string; site_id: string; name: string; nfc_tag_id: string | null;
  qr_code_hash: string | null; display_order: number; latitude: number; longitude: number;
  sites?: { name: string };
};

type Site = { id: string; name: string };

function QrDialog({ checkpoint }: { checkpoint: Checkpoint }) {
  const [open, setOpen] = useState(false);
  const hash = checkpoint.qr_code_hash || "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(hash)}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-100">
        <QrCode className="h-3 w-3" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>QR — {checkpoint.name}</DialogTitle></DialogHeader>
        {hash ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <img src={qrUrl} alt={`QR ${checkpoint.name}`} className="h-64 w-64 rounded border" />
            <p className="text-xs text-gray-500 break-all">Hash: {hash}</p>
            <div className="flex gap-2">
              <a href={qrUrl} download={`qr-${hash}.png`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Unduh</a>
              <a href={qrUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100">Cetak</a>
            </div>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-gray-400">Belum ada QR hash — pasang NFC tag dulu atau buat QR hash secara manual.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ checkpoint }: { checkpoint: Checkpoint }) {
  return (
    <Dialog>
      <DialogTrigger className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-100">
        <Pencil className="h-3 w-3" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Checkpoint</DialogTitle></DialogHeader>
        <form action={updateCheckpoint.bind(null, checkpoint.id)} className="space-y-3">
          <div><Label>Nama</Label><Input name="name" defaultValue={checkpoint.name} required /></div>
          <input type="hidden" name="site_id" value={checkpoint.site_id} />
          <div><Label>Latitude</Label><Input name="latitude" type="number" step="any" defaultValue={checkpoint.latitude} required /></div>
          <div><Label>Longitude</Label><Input name="longitude" type="number" step="any" defaultValue={checkpoint.longitude} required /></div>
          <div><Label>Urutan Tampilan</Label><Input name="display_order" type="number" defaultValue={checkpoint.display_order} /></div>
          <Button type="submit">Simpan</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CheckpointsPage() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase.from("checkpoints").select("*, sites(name)").order("site_id").order("display_order")
      .then(({ data }) => setCheckpoints(data || []));
    supabase.from("sites").select("id, name").order("name")
      .then(({ data }) => setSites(data || []));
  }, [supabase]);

  const columns: ColumnDef<Checkpoint>[] = [
    { accessorKey: "sites.name", header: "Site", cell: ({ row }) => row.original.sites?.name ?? "-" },
    { accessorKey: "name", header: "Nama Checkpoint" },
    { accessorKey: "display_order", header: "Urutan" },
    { accessorKey: "nfc_tag_id", header: "NFC Tag", cell: ({ row }) => row.original.nfc_tag_id || "Belum dipasang" },
    { accessorKey: "latitude", header: "Latitude", cell: ({ row }) => row.original.latitude.toFixed(6) },
    { accessorKey: "longitude", header: "Longitude", cell: ({ row }) => row.original.longitude.toFixed(6) },
    {
      id: "qr", header: "QR",
      cell: ({ row }) => <QrDialog checkpoint={row.original} />,
    },
    {
      id: "actions", header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <EditDialog checkpoint={row.original} />
          <form action={deleteCheckpoint.bind(null, row.original.id)}>
            <Button variant="destructive" size="sm" type="submit"><Trash2 className="h-3 w-3" /></Button>
          </form>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Kelola Checkpoint</h2>
        <Dialog>
          <DialogTrigger className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="mr-2 inline h-4 w-4" />Tambah Checkpoint
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tambah Checkpoint Baru</DialogTitle></DialogHeader>
            <form action={createCheckpoint} className="space-y-3">
              <div><Label>Site</Label>
                <FormSelect name="site_id" required placeholder="Pilih site"
                  options={sites.map((s) => ({ value: s.id, label: s.name }))} />
              </div>
              <div><Label>Nama</Label><Input name="name" placeholder="Toilet Lt. 1" required /></div>
              <div><Label>Latitude</Label><Input name="latitude" type="number" step="any" placeholder="-6.2088" required /></div>
              <div><Label>Longitude</Label><Input name="longitude" type="number" step="any" placeholder="106.8456" required /></div>
              <div><Label>Urutan Tampilan</Label><Input name="display_order" type="number" defaultValue={0} /></div>
              <Button type="submit">Simpan</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={checkpoints} />
    </div>
  );
}
