"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createSite(formData: FormData) {
  const supabase = await createClient();
  const latRaw = formData.get("latitude") as string;
  const lngRaw = formData.get("longitude") as string;
  await supabase.from("sites").insert({
    name: formData.get("name") as string,
    latitude: latRaw ? parseFloat(latRaw) : null,
    longitude: lngRaw ? parseFloat(lngRaw) : null,
    radius_meters: parseInt(formData.get("radius_meters") as string) || 50,
    start_time: (formData.get("start_time") as string) || "08:00",
  });
  revalidatePath("/admin/sites");
  redirect("/admin/sites");
}

export async function updateSite(id: string, formData: FormData) {
  const supabase = await createClient();
  const latRaw = formData.get("latitude") as string;
  const lngRaw = formData.get("longitude") as string;
  await supabase
    .from("sites")
    .update({
      name: formData.get("name") as string,
      latitude: latRaw ? parseFloat(latRaw) : null,
      longitude: lngRaw ? parseFloat(lngRaw) : null,
      radius_meters: parseInt(formData.get("radius_meters") as string) || 50,
      start_time: (formData.get("start_time") as string) || "08:00",
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
