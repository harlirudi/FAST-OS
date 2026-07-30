import { supabase, supabaseUrl } from "./supabase";
import { isOnline, enqueue } from "./sync";
import * as FileSystem from "expo-file-system";

export type CheckpointSession = {
  id: string;
  checkpoint_id: string;
  status: "in_progress" | "completed" | "expired";
  started_at: string;
  finished_at: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  duration_minutes: number | null;
  checkpoints?: { name: string };
};

export async function startSession(
  identifier: string,
  mode: "nfc" | "qr",
  latitude: number,
  longitude: number
): Promise<{ success: boolean; message: string; sessionId?: string; checkpointName?: string }> {
  if (!isOnline()) {
    await enqueue({
      type: "checkpoint_start",
      payload: { identifier, mode, latitude, longitude },
      createdAt: new Date().toISOString(),
    });
    return { success: true, message: "Tersimpan lokal. Akan disinkron saat online.", sessionId: "local-" + Date.now(), checkpointName: identifier };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${supabaseUrl}/functions/v1/checkpoint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      action: "start",
      nfc_tag_id: mode === "nfc" ? identifier : undefined,
      qr_code_hash: mode === "qr" ? identifier : undefined,
      latitude,
      longitude,
    }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, message: data.error || "Gagal memulai sesi" };
  return {
    success: true,
    message: data.message,
    sessionId: data.session_id,
    checkpointName: data.checkpoint_name,
  };
}

export async function uploadSessionPhoto(
  sessionId: string,
  photoType: "before" | "after",
  photoUrl: string
): Promise<{ success: boolean; message: string }> {
  if (!isOnline()) {
    await enqueue({
      type: "checkpoint_photo",
      payload: { sessionId, photoType, photoUrl },
      createdAt: new Date().toISOString(),
    });
    return { success: true, message: "Tersimpan lokal." };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${supabaseUrl}/functions/v1/checkpoint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ action: "photo", session_id: sessionId, photo_type: photoType, photo_url: photoUrl }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, message: data.error || "Gagal upload foto" };
  return { success: true, message: data.message };
}

export async function completeSession(
  sessionId: string,
  photoUrl: string,
  latitude: number,
  longitude: number
): Promise<{ success: boolean; message: string; duration?: number }> {
  if (!isOnline()) {
    await enqueue({
      type: "checkpoint_complete",
      payload: { sessionId, photoUrl, latitude, longitude },
      createdAt: new Date().toISOString(),
    });
    return { success: true, message: "Tersimpan lokal. Akan disinkron saat online." };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${supabaseUrl}/functions/v1/checkpoint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ action: "complete", session_id: sessionId, photo_url: photoUrl, latitude, longitude }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, message: data.error || "Gagal menyelesaikan sesi" };
  return { success: true, message: data.message, duration: data.duration_minutes };
}

export async function getTodaySessions(): Promise<CheckpointSession[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: dbUser } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
  if (!dbUser) return [];

  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("checkpoint_logs")
    .select("*, checkpoints(name)")
    .eq("user_id", dbUser.id)
    .gte("created_at", today)
    .order("started_at", { ascending: false });

  return (data || []) as CheckpointSession[];
}

export async function uploadPhotoToStorage(uri: string, userId: string): Promise<string | null> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  const ext = uri.endsWith(".jpg") || uri.endsWith(".jpeg") ? "jpg" : "png";
  const fileName = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("attendance-photos")
    .upload(fileName, decode(base64), { contentType: `image/${ext}`, upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from("attendance-photos").getPublicUrl(fileName);
  return data.publicUrl;
}

function decode(base64: string) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const bytes = [];
  for (let i = 0; i < base64.length; i += 4) {
    const e = chars.indexOf(base64[i]), f = chars.indexOf(base64[i + 1]);
    const g = chars.indexOf(base64[i + 2]), h = chars.indexOf(base64[i + 3]);
    bytes.push((e << 2) | (f >> 4));
    if (g !== 64) bytes.push(((f & 15) << 4) | (g >> 2));
    if (h !== 64) bytes.push(((g & 3) << 6) | h);
  }
  return new Uint8Array(bytes);
}

export function parseQrCode(value: string): string | null {
  // QR format: "qr_<hash>" as generated in NFC pairing
  if (value.startsWith("qr_")) return value;
  // Fallback: assume the value itself is the hash
  return value;
}
