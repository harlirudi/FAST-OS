import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSite, updateSite, deleteSite } from "@/lib/supabase/site-actions";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type Site = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  created_at: string;
};

const columns: ColumnDef<Site>[] = [
  { accessorKey: "name", header: "Nama" },
  {
    accessorKey: "latitude",
    header: "Latitude",
    cell: ({ row }) => row.original.latitude.toFixed(6),
  },
  {
    accessorKey: "longitude",
    header: "Longitude",
    cell: ({ row }) => row.original.longitude.toFixed(6),
  },
  { accessorKey: "radius_meters", header: "Radius (m)" },
  {
    id: "actions",
    header: "Aksi",
    cell: ({ row }) => {
      const site = row.original;
      return (
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger>
              <Button variant="outline" size="sm" type="button">
                <Pencil className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Site</DialogTitle>
              </DialogHeader>
              <form action={updateSite.bind(null, site.id)} className="space-y-3">
                <div>
                  <Label>Nama</Label>
                  <Input name="name" defaultValue={site.name} required />
                </div>
                <div>
                  <Label>Latitude</Label>
                  <Input name="latitude" type="number" step="any" defaultValue={site.latitude} required />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input name="longitude" type="number" step="any" defaultValue={site.longitude} required />
                </div>
                <div>
                  <Label>Radius (meter)</Label>
                  <Input name="radius_meters" type="number" defaultValue={site.radius_meters} />
                </div>
                <Button type="submit">Simpan</Button>
              </form>
            </DialogContent>
          </Dialog>
          <form action={deleteSite.bind(null, site.id)}>
            <Button variant="destructive" size="sm" type="submit">
              <Trash2 className="h-3 w-3" />
            </Button>
          </form>
        </div>
      );
    },
  },
];

export default async function SitesPage() {
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("sites")
    .select("*")
    .order("created_at");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Kelola Site</h2>
        <Dialog>
          <DialogTrigger>
            <Button type="button">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Site
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Site Baru</DialogTitle>
            </DialogHeader>
            <form action={createSite} className="space-y-3">
              <div>
                <Label>Nama</Label>
                <Input name="name" placeholder="Gedung Utama" required />
              </div>
              <div>
                <Label>Latitude</Label>
                <Input name="latitude" type="number" step="any" placeholder="-6.2088" required />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input name="longitude" type="number" step="any" placeholder="106.8456" required />
              </div>
              <div>
                <Label>Radius (meter)</Label>
                <Input name="radius_meters" type="number" defaultValue={50} />
              </div>
              <Button type="submit">Simpan</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={sites || []} />
    </div>
  );
}
