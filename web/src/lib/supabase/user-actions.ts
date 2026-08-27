"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Update profil user + sinkronkan user_sites (multi-site) via RPC atomik
// (hapus+insert dalam satu transaksi — anti duplicate key / race).
// Cleaner/Security MAKSIMAL 1 site; Supervisor boleh banyak.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateUserRole(userId: string, formData: FormData) {
  const supabase = await createClient();
  const newRole = formData.get("role") as string;
  const siteIds = [...new Set(
    formData.getAll("site_ids").map(String).filter((s) => UUID_RE.test(s))
  )];

  if (newRole !== "supervisor" && siteIds.length > 1) {
    return { success: false, message: "Cleaner/Security hanya bisa 1 site. Pilih satu site saja." };
  }

  const primarySiteId = siteIds[0] ?? null;

  const { error } = await supabase
    .from("users")
    .update({
      role: newRole,
      site_id: primarySiteId,
      name: formData.get("name") as string,
    })
    .eq("id", userId);
  if (error) return { success: false, message: error.message };

  // RPC atomik: hapus semua + insert baru dalam SATU transaksi
  const { error: rpcErr } = await supabase.rpc("replace_user_sites", {
    p_user_id: userId,
    p_site_ids: siteIds,
  });
  if (rpcErr) return { success: false, message: rpcErr.message };

  revalidatePath("/admin/users");
  return { success: true, message: null };
}

export async function deleteUser(userId: string) {
  "use server";
  const supabase = await createClient();
  await supabase.from("users").delete().eq("id", userId);
  revalidatePath("/admin/users");
}
