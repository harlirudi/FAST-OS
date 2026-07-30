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
import { pairNfcTag } from "@/lib/supabase/admin-actions";
import { Radio } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type Checkpoint = {
  id: string;
  site_id: string;
  name: string;
  nfc_tag_id: string | null;
  qr_code_hash: string | null;
  sites?: { name: string };
};

const columns: ColumnDef<Checkpoint>[] = [
  {
    accessorKey: "sites.name",
    header: "Site",
    cell: ({ row }) => row.original.sites?.name ?? "-",
  },
  { accessorKey: "name", header: "Checkpoint" },
  {
    accessorKey: "nfc_tag_id",
    header: "NFC Tag ID",
    cell: ({ row }) =>
      row.original.nfc_tag_id ? (
        <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">
          {row.original.nfc_tag_id}
        </code>
      ) : (
        <span className="text-gray-400">Belum dipasang</span>
      ),
  },
  {
    accessorKey: "qr_code_hash",
    header: "QR Hash",
    cell: ({ row }) =>
      row.original.qr_code_hash ? (
        <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">
          {row.original.qr_code_hash}
        </code>
      ) : (
        <span className="text-gray-400">-</span>
      ),
  },
  {
    id: "actions",
    header: "Aksi",
    cell: ({ row }) => (
      <PairDialog checkpoint={row.original} />
    ),
  },
];

function PairDialog({ checkpoint }: { checkpoint: Checkpoint }) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm" type="button">
          <Radio className="mr-1 h-3 w-3" />
          Pasang NFC
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pasang NFC Tag — {checkpoint.name}</DialogTitle>
        </DialogHeader>
        <form action={pairNfcTag.bind(null, checkpoint.id)} className="space-y-3">
          <div>
            <Label>NFC Tag ID</Label>
            <Input
              name="nfc_tag_id"
              placeholder="04A1B2C3D4E5F6"
              defaultValue={checkpoint.nfc_tag_id ?? ""}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Input ID dari NFC tag fisik. QR hash dibuat otomatis.
            </p>
          </div>
          <Button type="submit">Simpan</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default async function NfcPage() {
  const supabase = await createClient();
  const { data: checkpoints } = await supabase
    .from("checkpoints")
    .select("*, sites(name)")
    .order("site_id")
    .order("display_order");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">NFC Pairing</h2>
      <p className="text-sm text-gray-500">
        Pasangkan NFC tag ID ke setiap checkpoint. QR hash dibuat otomatis.
      </p>
      <DataTable columns={columns} data={checkpoints || []} />
    </div>
  );
}
