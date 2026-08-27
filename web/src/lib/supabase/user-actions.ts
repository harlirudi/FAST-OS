"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Update profil user + sinkronkan user_sites (multi-site):
// hapus semua assignment lama → insert pilihan baru → users.site_id = site utama
// (site pertama; null jika tidak ada — kompatibel dengan logika single-site lama).
// Cleaner/Security MAKSIMAL 1 site; Supervisor boleh banyak.
export async function updateUserRole(userId: string, formData: FormData) {
  const supabase = await createClient();
  const newRole = formData.get("role") as string;
  const siteIds = formData.getAll("site_ids").map(String).filter((s) => s && s !== "none");

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

  const { error: delErr } = await supabase.from("user_sites").delete().eq("user_id", userId);
  if (delErr) return { success: false, message: delErr.message };

  if (siteIds.length > 0) {
    const { error: insErr } = await supabase.from("user_sites").insert(
      siteIds.map((site_id) => ({ user_id: userId, site_id }))
    );
    if (insErr) return { success: false, message: insErr.message };
  }

  revalidatePath("/admin/users");
  return { success: true, message: null };
}

export async function deleteUser(userId: string) {
  "use server";
  const supabase = await createClient();
  await supabase.from("users").delete().eq("id", userId);
  revalidatePath("/admin/users");
}
