import { supabase, supabaseUrl } from "./supabase";
import { isOnline, enqueue } from "./sync";
import * as FileSystem from "expo-file-system/legacy";

export type AttendanceStatus = {
  checkedIn: boolean;
  lastCheckIn: string | null;
  siteName: string | null;
  completedCheckpoints: number;
  totalCheckpoints: number;
};

export async function getAttendanceStatus(checkpointType: "cleaning" | "security" = "cleaning"): Promise<AttendanceStatus> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { checkedIn: false, lastCheckIn: null, siteName: null, completedCheckpoints: 0, totalCheckpoints: 0 };

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, site_id")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser?.site_id) {
    return { checkedIn: false, lastCheckIn: null, siteName: null, completedCheckpoints: 0, totalCheckpoints: 0 };
  }

  const today = new Date().toISOString().split("T")[0];
  const userId = dbUser.id;

  const { data: checkIns } = await supabase
    .from("attendance_logs")
    .select("type, timestamp")
    .eq("user_id", userId)
    .gte("timestamp", today)
    .order("timestamp", { ascending: false });

  const lastCheckIn = checkIns?.find((l) => l.type === "check_in");
  const lastCheckOut = checkIns?.find((l) => l.type === "check_out");
  const checkedIn = !!lastCheckIn && (!lastCheckOut || lastCheckIn.timestamp > lastCheckOut.timestamp);

  const { data: site } = await supabase
    .from("sites")
    .select("name")
    .eq("id", dbUser.site_id)
    .single();

  const { count: total } = await supabase
    .from("checkpoints")
    .select("*", { count: "exact", head: true })
    .eq("site_id", dbUser.site_id)
    .eq("type", checkpointType);

  const { count: completed } = await supabase
    .from("checkpoint_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("created_at", today)
    .eq("checkpoints.type", checkpointType);

  return {
    checkedIn,
    lastCheckIn: lastCheckIn?.timestamp ?? null,
    siteName: site?.name ?? null,
    completedCheckpoints: completed ?? 0,
    totalCheckpoints: total ?? 0,
  };
}

export async function submitAttendance(
  type: "check_in" | "check_out",
  latitude: number,
  longitude: number,
  photoUrl: string,
  overrideReason?: string
): Promise<{ success: boolean; message: string }> {
  // Offline: simpan ke antrian
  if (!isOnline()) {
    if (type === "check_in") {
      await enqueue("check_in", { latitude, longitude, photoUrl, reason: overrideReason });
    } else {
      await enqueue("check_out", { latitude, longitude, photoUrl });
    }
    return { success: true, message: "Tersimpan lokal. Akan disinkron saat online." };
  }

  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(
    `${supabaseUrl}/functions/v1/attendance`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        type,
        latitude,
        longitude,
        photo_url: photoUrl,
        override_reason: overrideReason || undefined,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    return { success: false, message: data.error || "Gagal" };
  }
  return { success: true, message: data.message };
}

export async function uploadPhoto(uri: string, userId: string): Promise<string | null> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const bytes: number[] = [];
  for (let i = 0; i < base64.length; i += 4) {
    const e = chars.indexOf(base64[i]), f = chars.indexOf(base64[i + 1]);
    const g = chars.indexOf(base64[i + 2]), h = chars.indexOf(base64[i + 3]);
    bytes.push((e << 2) | (f >> 4));
    if (g !== 64) bytes.push(((f & 15) << 4) | (g >> 2));
    if (h !== 64) bytes.push(((g & 3) << 6) | h);
  }

  const ext = uri.endsWith(".jpg") || uri.endsWith(".jpeg") ? "jpg" : "png";
  const fileName = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("attendance-photos")
    .upload(fileName, new Uint8Array(bytes), { contentType: `image/${ext}` });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  const { data } = supabase.storage.from("attendance-photos").getPublicUrl(fileName);
  return data.publicUrl;
}
