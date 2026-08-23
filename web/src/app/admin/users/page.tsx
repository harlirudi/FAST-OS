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
import { updateUserRole, deleteUser } from "@/lib/supabase/user-actions";
import { Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type User = { id: string; name: string; role: string; site_id: string | null; sites?: { name: string } | null };
type Site = { id: string; name: string };

function EditUserDialog({ user, onSaved }: { user: User; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [saving, setSaving] = useState(false);

  // Muat daftar site setiap dialog dibuka (hindari state stale)
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && sites.length === 0) {
      setLoadingSites(true);
      createClient()
        .from("sites")
        .select("id, name")
        .order("name")
        .then(({ data }) => {
          setSites(data || []);
          setLoadingSites(false);
        });
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    const result = await updateUserRole(user.id, formData);
    setSaving(false);
    if (result.success) {
      setOpen(false);
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-100">
        <Pencil className="h-3 w-3" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Pengguna — {user.name}</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-3">
          <div><Label>Nama</Label><Input name="name" defaultValue={user.name} required /></div>
          <div><Label>Peran</Label>
            <FormSelect name="role" defaultValue={user.role}
              options={[{ value: "admin", label: "Admin" }, { value: "supervisor", label: "Supervisor" }, { value: "cleaner", label: "Cleaner" }]} />
          </div>
          <div><Label>Site</Label>
            {loadingSites ? (
              <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">Memuat daftar site...</p>
            ) : (
              <FormSelect name="site_id" defaultValue={user.site_id ?? "none"}
                options={[{ value: "none", label: "Tidak ada" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
            )}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const supabase = createClient();

  const loadUsers = () => {
    supabase.from("users").select("*, sites(name)").order("role").order("name")
      .then(({ data }) => setUsers(data || []));
  };

  useEffect(() => {
    loadUsers();
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
        <EditUserDialog user={row.original} onSaved={loadUsers} />
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
