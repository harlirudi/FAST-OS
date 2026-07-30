import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/admin/data-table";
import { FormSelect } from "@/components/admin/form-select";
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
import { updateUserRole, deleteUser } from "@/lib/supabase/admin-actions";
import { Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type User = {
  id: string;
  auth_id: string | null;
  name: string;
  phone: string | null;
  role: string;
  site_id: string | null;
  sites?: { name: string } | null;
};

const columns: ColumnDef<User>[] = [
  { accessorKey: "name", header: "Nama" },
  {
    accessorKey: "role",
    header: "Peran",
    cell: ({ row }) => {
      const role = row.original.role;
      const colors: Record<string, string> = {
        admin: "bg-purple-100 text-purple-800",
        supervisor: "bg-blue-100 text-blue-800",
        cleaner: "bg-green-100 text-green-800",
      };
      return (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[role] || ""}`}>
          {role}
        </span>
      );
    },
  },
  {
    accessorKey: "sites.name",
    header: "Site",
    cell: ({ row }) => row.original.sites?.name ?? "-",
  },
  {
    id: "actions",
    header: "Aksi",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex gap-2">
          <EditUserDialog user={user} />
          <form action={deleteUser.bind(null, user.id)}>
            <Button variant="destructive" size="sm" type="submit">
              <Trash2 className="h-3 w-3" />
            </Button>
          </form>
        </div>
      );
    },
  },
];

function EditUserDialog({ user }: { user: User }) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm" type="button">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Pengguna</DialogTitle>
        </DialogHeader>
        <form action={updateUserRole.bind(null, user.id)} className="space-y-3">
          <div>
            <Label>Nama</Label>
            <Input name="name" defaultValue={user.name} required />
          </div>
          <div>
            <Label>Peran</Label>
            <FormSelect
              name="role"
              defaultValue={user.role}
              options={[
                { value: "admin", label: "Admin" },
                { value: "supervisor", label: "Supervisor" },
                { value: "cleaner", label: "Cleaner" },
              ]}
            />
          </div>
          <SiteSelect currentSiteId={user.site_id} />
          <Button type="submit">Simpan</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function SiteSelect({ currentSiteId }: { currentSiteId: string | null }) {
  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites").select("id, name");

  return (
    <div>
      <Label>Site</Label>
      <FormSelect
        name="site_id"
        defaultValue={currentSiteId ?? "none"}
        options={[
          { value: "none", label: "Tidak ada" },
          ...(sites?.map((s) => ({ value: s.id, label: s.name })) || []),
        ]}
      />
    </div>
  );
}

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("*, sites(name)")
    .order("role")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Kelola Pengguna</h2>
      </div>
      <DataTable columns={columns} data={users || []} />
    </div>
  );
}
