"use client";

export const dynamic = "force-dynamic";


import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/data-table";
import { FormSelect } from "@/components/admin/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { updateUserRole, deleteUser } from "@/lib/supabase/user-actions";
import { Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type User = { id: string; name: string; role: string; site_id: string | null; reference_photo_url: string | null; sites?: { name: string } | null; user_sites?: { site_id: string; sites?: { name: string } | null }[] | null };
type Site = { id: string; name: string };

function EditUserDialog({ user, onSaved }: { user: User; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [role, setRole] = useState(user.role);
  const [loadingSites, setLoadingSites] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Cleaner/Security maksimal 1 site; Supervisor bisa banyak site.
  const isMultiSite = role === "supervisor";

  // Muat daftar site setiap dialog dibuka (hindari state stale)
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setRole(user.role);
      setSelectedSites((user.user_sites ?? []).map((s) => s.site_id).filter(Boolean));
      if (sites.length === 0) {
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
    }
  };

  const toggleSite = (siteId: string) => {
    setSelectedSites((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setSaveError("");
    // Supervisor: multi-site dari checkbox (state). Cleaner/Security: 1 site
    // dari dropdown (hidden input FormSelect sudah ikut terkirim).
    if (isMultiSite) {
      selectedSites.forEach((siteId) => formData.append("site_ids", siteId));
    }
    const result = await updateUserRole(user.id, formData);
    setSaving(false);
    if (result.success) {
      setOpen(false);
      onSaved();
      toast.add({
        title: "Penugasan tersimpan",
        description: "User akan otomatis masuk ke aplikasi dalam ≤30 detik.",
        type: "success",
      });
    } else {
      setSaveError(result.message || "Gagal menyimpan perubahan.");
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
            <FormSelect name="role" defaultValue={user.role} onChange={setRole}
              options={[{ value: "admin", label: "Admin" }, { value: "supervisor", label: "Supervisor" }, { value: "cleaner", label: "Cleaner" }, { value: "security", label: "Security" }]} />
          </div>
          <div><Label>{isMultiSite ? "Site (bisa lebih dari satu — Supervisor)" : "Site (Cleaner/Security: satu)"}</Label>
            {loadingSites ? (
              <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">Memuat daftar site...</p>
            ) : isMultiSite ? (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {sites.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      name="site_ids"
                      value={s.id}
                      checked={selectedSites.includes(s.id)}
                      onChange={() => toggleSite(s.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">{s.name}</span>
                  </label>
                ))}
                {sites.length === 0 && <p className="px-2 py-1 text-sm text-slate-400">Belum ada site. Buat site dulu.</p>}
              </div>
            ) : (
              <FormSelect name="site_ids" defaultValue={user.user_sites?.[0]?.site_id ?? "none"}
                options={[{ value: "none", label: "Tidak ada" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
            )}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
          {saveError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const supabase = createClient();

  const loadUsers = () => {
    supabase.from("users").select("*, sites!users_site_id_fkey(name), user_sites(site_id, sites!user_sites_site_id_fkey(name))").order("role").order("name")
      .then(({ data }) => setUsers(data || []));
  };

  const handleDelete = async (id: string, userName: string) => {
    if (!window.confirm(`Hapus pengguna "${userName}"?`)) return;
    await deleteUser(id);
    loadUsers();
  };

  useEffect(() => {
    loadUsers();
  }, [supabase]);

  const columns: ColumnDef<User>[] = [
    { accessorKey: "name", header: "Nama" },
    { accessorKey: "role", header: "Peran", cell: ({ row }) => {
      const colors: Record<string, string> = { admin: "bg-purple-100 text-purple-800", supervisor: "bg-blue-100 text-blue-800", cleaner: "bg-green-100 text-green-800", security: "bg-amber-100 text-amber-800" };
      return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[row.original.role] || ""}`}>{row.original.role}</span>;
    }},
    { accessorKey: "sites.name", header: "Site", cell: ({ row }) => {
      const us = row.original.user_sites ?? [];
      const names = us.map((u) => u.sites?.name).filter(Boolean) as string[];
      if (names.length > 0) {
        return <div className="flex max-w-48 flex-wrap gap-1">{names.map((n) => <span key={n} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">{n}</span>)}</div>;
      }
      return row.original.sites?.name ?? "-";
    }},
    { id: "refPhoto", header: "Foto Patokan", cell: ({ row }) =>
      row.original.reference_photo_url
        ? <img src={row.original.reference_photo_url} alt="patokan" className="h-8 w-8 rounded-full border object-cover" />
        : <span className="text-xs text-gray-300">-</span>
    },
    { id: "actions", header: "Aksi", cell: ({ row }) => (
      <div className="flex gap-2">
        <EditUserDialog user={row.original} onSaved={loadUsers} />
        <Button
          variant="destructive"
          size="sm"
          type="button"
          onClick={() => handleDelete(row.original.id, row.original.name)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
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
