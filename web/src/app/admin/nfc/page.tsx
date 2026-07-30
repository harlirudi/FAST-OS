"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { pairNfcTag } from "@/lib/supabase/checkpoint-actions";
import { Radio } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type Checkpoint = {
  id: string; site_id: string; name: string; nfc_tag_id: string | null;
  qr_code_hash: string | null; sites?: { name: string };
};

function PairDialog({ checkpoint }: { checkpoint: Checkpoint }) {
  return (
    <Dialog>
      <DialogTrigger className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-100">
        <Radio className="mr-1 inline h-3 w-3" />Pasang NFC
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Pasang NFC Tag — {checkpoint.name}</DialogTitle></DialogHeader>
        <form action={pairNfcTag.bind(null, checkpoint.id)} className="space-y-3">
          <div>
            <Label>NFC Tag ID</Label>
            <Input name="nfc_tag_id" placeholder="04A1B2C3D4E5F6" defaultValue={checkpoint.nfc_tag_id ?? ""} required />
          </div>
          <Button type="submit">Simpan</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function NfcPage() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase.from("checkpoints").select("*, sites(name)").order("site_id").order("display_order")
      .then(({ data }) => setCheckpoints(data || []));
  }, [supabase]);

  const columns: ColumnDef<Checkpoint>[] = [
    { accessorKey: "sites.name", header: "Site", cell: ({ row }) => row.original.sites?.name ?? "-" },
    { accessorKey: "name", header: "Checkpoint" },
    { accessorKey: "nfc_tag_id", header: "NFC Tag ID", cell: ({ row }) =>
      row.original.nfc_tag_id
        ? <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{row.original.nfc_tag_id}</code>
        : <span className="text-gray-400">Belum dipasang</span>
    },
    { accessorKey: "qr_code_hash", header: "QR Hash", cell: ({ row }) =>
      row.original.qr_code_hash
        ? <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{row.original.qr_code_hash}</code>
        : <span className="text-gray-400">-</span>
    },
    { id: "actions", header: "Aksi", cell: ({ row }) => <PairDialog checkpoint={row.original} /> },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">NFC Pairing</h2>
      <DataTable columns={columns} data={checkpoints} />
    </div>
  );
}
