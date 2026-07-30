"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/data-table";
import { FormSelect } from "@/components/admin/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { createCheckpoint, updateCheckpoint, deleteCheckpoint } from "@/lib/supabase/checkpoint-actions";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type Checkpoint = {
  id: string; site_id: string; name: string; nfc_tag_id: string | null;
  qr_code_hash: string | null; display_order: number; latitude: number; longitude: number;
  sites?: { name: string };
};

type Site = { id: string; name: string };

function EditDialog({ checkpoint }: { checkpoint: Checkpoint }) {
  return (
    <Dialog>
      <DialogTrigger><Button variant="outline" size="sm" type="button"><Pencil className="h-3 w-3" /></Button></DialogTrigger>
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
          <DialogTrigger><Button type="button"><Plus className="mr-2 h-4 w-4" />Tambah Checkpoint</Button></DialogTrigger>
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
