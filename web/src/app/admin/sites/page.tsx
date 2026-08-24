"use client";

export const dynamic = "force-dynamic";


import { useEffect, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { createSite, updateSite, deleteSite } from "@/lib/supabase/site-actions";
import { LocationSearch } from "@/components/admin/location-search";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type Site = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  created_at: string;
};

function EditDialog({ site }: { site: Site }) {
  const [lat, setLat] = useState(site.latitude?.toString() ?? "");
  const [lng, setLng] = useState(site.longitude?.toString() ?? "");
  return (
    <Dialog>
      <DialogTrigger className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-100">
        <Pencil className="h-3 w-3" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Site</DialogTitle></DialogHeader>
        <form action={updateSite.bind(null, site.id)} className="space-y-3">
          <div><Label>Nama</Label><Input name="name" defaultValue={site.name} required /></div>
          <div>
            <Label>Koordinat — cari nama tempat, atau isi manual</Label>
            <LocationSearch onPick={(la, ln) => { setLat(String(la)); setLng(String(ln)); }} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1"><Label>Latitude</Label><Input name="latitude" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
            <div className="flex-1"><Label>Longitude</Label><Input name="longitude" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} /></div>
          </div>
          <div><Label>Radius (meter)</Label><Input name="radius_meters" type="number" defaultValue={site.radius_meters} /></div>
          <Button type="submit">Simpan</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateSiteDialog() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  return (
    <Dialog>
      <DialogTrigger className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        <Plus className="mr-2 inline h-4 w-4" />Tambah Site
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Tambah Site Baru</DialogTitle></DialogHeader>
        <form action={createSite} className="space-y-3">
          <div><Label>Nama</Label><Input name="name" placeholder="Gedung Utama" required /></div>
          <div>
            <Label>Koordinat — cari nama tempat, atau isi manual</Label>
            <LocationSearch onPick={(la, ln) => { setLat(String(la)); setLng(String(ln)); }} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1"><Label>Latitude</Label><Input name="latitude" type="number" step="any" placeholder="-6.2088" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
            <div className="flex-1"><Label>Longitude</Label><Input name="longitude" type="number" step="any" placeholder="106.8456" value={lng} onChange={(e) => setLng(e.target.value)} /></div>
          </div>
          <div><Label>Radius (meter)</Label><Input name="radius_meters" type="number" defaultValue={50} /></div>
          <p className="text-xs text-gray-500">
            Kosongkan koordinat — supervisor bisa set via GPS di mobile app, atau cari nama tempat di atas.
          </p>
          <Button type="submit">Simpan</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SitesPage() {
  // force-dynamic via file

  const [sites, setSites] = useState<Site[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase.from("sites").select("*").order("created_at").then(({ data }) => setSites(data || []));
  }, [supabase]);

  const columns: ColumnDef<Site>[] = [
    { accessorKey: "name", header: "Nama" },
    { accessorKey: "latitude", header: "Latitude", cell: ({ row }) => row.original.latitude != null ? row.original.latitude.toFixed(6) : "-" },
    { accessorKey: "longitude", header: "Longitude", cell: ({ row }) => row.original.longitude != null ? row.original.longitude.toFixed(6) : "-" },
    { accessorKey: "radius_meters", header: "Radius (m)" },
    {
      id: "actions", header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <EditDialog site={row.original} />
          <form action={deleteSite.bind(null, row.original.id)}>
            <Button variant="destructive" size="sm" type="submit"><Trash2 className="h-3 w-3" /></Button>
          </form>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Kelola Site</h2>
        <CreateSiteDialog />
      </div>
      <DataTable columns={columns} data={sites} />
    </div>
  );
}
