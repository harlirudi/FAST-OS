"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateUserRole(userId: string, formData: FormData) {
  const supabase = await createClient();
  const siteId = formData.get("site_id") as string;
  const { error } = await supabase
    .from("users")
    .update({
      role: formData.get("role") as string,
      site_id: siteId === "none" ? null : siteId,
      name: formData.get("name") as string,
    })
    .eq("id", userId);
  revalidatePath("/admin/users");
  return { success: !error, message: error?.message ?? null };
}

export async function deleteUser(userId: string) {
  "use server";
  const supabase = await createClient();
  await supabase.from("users").delete().eq("id", userId);
  revalidatePath("/admin/users");
}
