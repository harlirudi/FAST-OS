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

export async function refreshCheckpointQr(checkpointId: string) {
  "use server";
  const supabase = await createClient();

  // Ambil checkpoint: NFC tag (untuk prefix) + generasi saat ini
  const { data: cp } = await supabase
    .from("checkpoints")
    .select("nfc_tag_id, qr_generation")
    .eq("id", checkpointId)
    .single();

  const tagPrefix = (cp?.nfc_tag_id || "0000").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toLowerCase() || "0000";
  const generation = (cp?.qr_generation || 1) + 1;
  const random = Math.random().toString(36).slice(2, 8);

  await supabase
    .from("checkpoints")
    .update({
      qr_code_hash: `qr_${tagPrefix}_v${generation}_${random}`,
      qr_generation: generation,
    })
    .eq("id", checkpointId);
  revalidatePath("/admin/checkpoints");
}
