"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
