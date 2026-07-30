"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ==================== Sites ====================

export async function createSite(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("sites").insert({
    name: formData.get("name") as string,
    latitude: parseFloat(formData.get("latitude") as string),
    longitude: parseFloat(formData.get("longitude") as string),
    radius_meters: parseInt(formData.get("radius_meters") as string) || 50,
  });
  revalidatePath("/admin/sites");
  redirect("/admin/sites");
}

export async function updateSite(id: string, formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("sites")
    .update({
      name: formData.get("name") as string,
      latitude: parseFloat(formData.get("latitude") as string),
      longitude: parseFloat(formData.get("longitude") as string),
      radius_meters: parseInt(formData.get("radius_meters") as string) || 50,
    })
    .eq("id", id);
  revalidatePath("/admin/sites");
  redirect("/admin/sites");
}

export async function deleteSite(id: string) {
  "use server";
  const supabase = await createClient();
  await supabase.from("sites").delete().eq("id", id);
  revalidatePath("/admin/sites");
}

// ==================== Checkpoints ====================

export async function createCheckpoint(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("checkpoints").insert({
    site_id: formData.get("site_id") as string,
    name: formData.get("name") as string,
    latitude: parseFloat(formData.get("latitude") as string),
    longitude: parseFloat(formData.get("longitude") as string),
    display_order: parseInt(formData.get("display_order") as string) || 0,
  });
  revalidatePath("/admin/checkpoints");
  redirect("/admin/checkpoints");
}

export async function updateCheckpoint(id: string, formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("checkpoints")
    .update({
      site_id: formData.get("site_id") as string,
      name: formData.get("name") as string,
      latitude: parseFloat(formData.get("latitude") as string),
      longitude: parseFloat(formData.get("longitude") as string),
      display_order: parseInt(formData.get("display_order") as string) || 0,
    })
    .eq("id", id);
  revalidatePath("/admin/checkpoints");
  redirect("/admin/checkpoints");
}

export async function deleteCheckpoint(id: string) {
  "use server";
  const supabase = await createClient();
  await supabase.from("checkpoints").delete().eq("id", id);
  revalidatePath("/admin/checkpoints");
}

// ==================== NFC Pairing ====================

export async function pairNfcTag(checkpointId: string, formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("checkpoints")
    .update({
      nfc_tag_id: formData.get("nfc_tag_id") as string,
      qr_code_hash: `qr_${(formData.get("nfc_tag_id") as string).toLowerCase()}`,
    })
    .eq("id", checkpointId);
  revalidatePath("/admin/nfc");
  redirect("/admin/nfc");
}

// ==================== Users ====================

export async function updateUserRole(userId: string, formData: FormData) {
  const supabase = await createClient();
  const siteId = formData.get("site_id") as string;
  await supabase
    .from("users")
    .update({
      role: formData.get("role") as string,
      site_id: siteId === "none" ? null : siteId,
      name: formData.get("name") as string,
    })
    .eq("id", userId);
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function deleteUser(userId: string) {
  "use server";
  const supabase = await createClient();
  await supabase.from("users").delete().eq("id", userId);
  revalidatePath("/admin/users");
}
