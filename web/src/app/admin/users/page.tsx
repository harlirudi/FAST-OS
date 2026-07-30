"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/data-table";
import { FormSelect } from "@/components/admin/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { updateUserRole, deleteUser } from "@/lib/supabase/user-actions";
import { Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type User = { id: string; name: string; role: string; site_id: string | null; sites?: { name: string } | null };
type Site = { id: string; name: string };

function EditUserDialog({ user, sites }: { user: User; sites: Site[] }) {
  return (
    <Dialog>
      <DialogTrigger><Button variant="outline" size="sm" type="button"><Pencil className="h-3 w-3" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Pengguna</DialogTitle></DialogHeader>
        <form action={updateUserRole.bind(null, user.id)} className="space-y-3">
          <div><Label>Nama</Label><Input name="name" defaultValue={user.name} required /></div>
          <div><Label>Peran</Label>
            <FormSelect name="role" defaultValue={user.role}
              options={[{ value: "admin", label: "Admin" }, { value: "supervisor", label: "Supervisor" }, { value: "cleaner", label: "Cleaner" }]} />
          </div>
          <div><Label>Site</Label>
            <FormSelect name="site_id" defaultValue={user.site_id ?? "none"}
              options={[{ value: "none", label: "Tidak ada" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
          </div>
          <Button type="submit">Simpan</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase.from("users").select("*, sites(name)").order("role").order("name")
      .then(({ data }) => setUsers(data || []));
    supabase.from("sites").select("id, name")
      .then(({ data }) => setSites(data || []));
  }, [supabase]);

  const columns: ColumnDef<User>[] = [
    { accessorKey: "name", header: "Nama" },
    { accessorKey: "role", header: "Peran", cell: ({ row }) => {
      const colors: Record<string, string> = { admin: "bg-purple-100 text-purple-800", supervisor: "bg-blue-100 text-blue-800", cleaner: "bg-green-100 text-green-800" };
      return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[row.original.role] || ""}`}>{row.original.role}</span>;
    }},
    { accessorKey: "sites.name", header: "Site", cell: ({ row }) => row.original.sites?.name ?? "-" },
    { id: "actions", header: "Aksi", cell: ({ row }) => (
      <div className="flex gap-2">
        <EditUserDialog user={row.original} sites={sites} />
        <form action={deleteUser.bind(null, row.original.id)}>
          <Button variant="destructive" size="sm" type="submit"><Trash2 className="h-3 w-3" /></Button>
        </form>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Kelola Pengguna</h2>
      </div>
      <DataTable columns={columns} data={users} />
    </div>
  );
}
