import { supabase, supabaseUrl } from "./supabase";

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  checkedIn: boolean;
  lastCheckIn: string | null;
  completedCheckpoints: number;
  totalCheckpoints: number;
};

export type OverrideEvent = {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  overrideReason: string;
};

export async function getTeamStatus(siteId: string): Promise<TeamMember[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data: team } = await supabase
    .from("users")
    .select("id, name, role")
    .in("role", ["cleaner", "security"])
    .eq("site_id", siteId);

  if (!team) return [];

  const userIds = team.map((c) => c.id);

  const { data: attendance } = await supabase
    .from("attendance_logs")
    .select("user_id, type, timestamp")
    .in("user_id", userIds)
    .gte("timestamp", today)
    .order("timestamp", { ascending: false });

  const { data: total } = await supabase
    .from("checkpoints")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId);

  const totalCP = total?.length ?? 0;

  const { data: completed } = await supabase
    .from("checkpoint_logs")
    .select("user_id")
    .in("user_id", userIds)
    .eq("status", "completed")
    .gte("created_at", today);

  const completedByUser: Record<string, number> = {};
  completed?.forEach((l) => {
    completedByUser[l.user_id] = (completedByUser[l.user_id] || 0) + 1;
  });

  return team.map((c) => {
    const logs = (attendance || []).filter((a) => a.user_id === c.id);
    const lastCheckIn = logs.filter((l) => l.type === "check_in")[0];
    const lastCheckOut = logs.filter((l) => l.type === "check_out")[0];

    return {
      id: c.id,
      name: c.name,
      role: c.role,
      checkedIn: !!lastCheckIn && (!lastCheckOut || lastCheckIn.timestamp > lastCheckOut.timestamp),
      lastCheckIn: lastCheckIn?.timestamp ?? null,
      completedCheckpoints: completedByUser[c.id] || 0,
      totalCheckpoints: totalCP,
    };
  });
}

export async function getOverrides(siteId: string): Promise<OverrideEvent[]> {
  const { data } = await supabase
    .from("attendance_logs")
    .select("id, user_id, timestamp, override_reason, users(name)")
    .eq("site_id", siteId)
    .eq("is_flagged", true)
    .order("timestamp", { ascending: false });

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.users?.name || "unknown",
    timestamp: row.timestamp,
    overrideReason: row.override_reason,
  }));
}

export type CheckpointInspection = {
  id: string;
  checkpointName: string;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  note: string | null;
  finishedAt: string;
  cleanerName: string;
};

export async function getLastCleaningPerCheckpoint(siteId: string): Promise<CheckpointInspection[]> {
  const { data } = await supabase
    .from("checkpoint_logs")
    .select("id, checkpoint_id, before_photo_url, after_photo_url, finished_at, checkpoints(name), users(name)")
    .eq("site_id", siteId)
    .eq("status", "completed")
    .eq("log_type", "cleaning")
    .order("finished_at", { ascending: false });

  if (!data) return [];

  const latest: Record<string, CheckpointInspection> = {};
  for (const row of data) {
    if (!latest[row.checkpoint_id]) {
      latest[row.checkpoint_id] = {
        id: row.id,
        checkpointName: (row as any).checkpoints?.name || "unknown",
        beforePhotoUrl: row.before_photo_url,
        afterPhotoUrl: row.after_photo_url,
        note: null,
        finishedAt: row.finished_at,
        cleanerName: (row as any).users?.name || "unknown",
      };
    }
  }

  return Object.values(latest);
}

export async function getMyInspections(): Promise<CheckpointInspection[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: dbUser } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
  if (!dbUser) return [];

  const { data } = await supabase
    .from("checkpoint_logs")
    .select("id, checkpoint_id, inspection_note, finished_at, checkpoints(name)")
    .eq("user_id", dbUser.id)
    .eq("log_type", "inspection")
    .order("finished_at", { ascending: false });

  return (data || []).map((row: any) => ({
    id: row.id,
    checkpointName: row.checkpoints?.name || "unknown",
    beforePhotoUrl: null,
    afterPhotoUrl: null,
    note: row.inspection_note,
    finishedAt: row.finished_at,
    cleanerName: "",
  }));
}

export async function startInspection(
  identifier: string,
  mode: "nfc" | "qr",
  latitude: number,
  longitude: number,
  note?: string
): Promise<{ success: boolean; message: string; sessionId?: string }> {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(`${supabaseUrl}/functions/v1/checkpoint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      action: "inspect",
      nfc_tag_id: mode === "nfc" ? identifier : undefined,
      qr_code_hash: mode === "qr" ? identifier : undefined,
      latitude,
      longitude,
      note,
    }),
  });

  const data = await res.json();
  if (!res.ok) return { success: false, message: data.error || "Gagal" };
  return { success: true, message: data.message, sessionId: data.session_id };
}

export async function pairNfcTagToCheckpoint(
  checkpointId: string,
  nfcTagId: string,
  latitude: number,
  longitude: number
): Promise<{ success: boolean; message: string }> {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(`${supabaseUrl}/functions/v1/pair-nfc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      checkpoint_id: checkpointId,
      nfc_tag_id: nfcTagId,
      latitude,
      longitude,
    }),
  });

  const data = await res.json();
  if (!res.ok) return { success: false, message: data.error || "Gagal pairing" };
  return { success: true, message: data.message };
}

export type PairingCheckpoint = {
  id: string;
  name: string;
  nfc_tag_id: string | null;
  qr_code_hash: string | null;
  latitude: number;
  longitude: number;
};

export async function getCheckpointsForPairing(siteId: string): Promise<PairingCheckpoint[]> {
  const { data } = await supabase
    .from("checkpoints")
    .select("id, name, nfc_tag_id, qr_code_hash, latitude, longitude")
    .eq("site_id", siteId)
    .order("display_order");
  return (data || []) as PairingCheckpoint[];
}

export async function updateSiteLocation(
  siteId: string,
  latitude: number,
  longitude: number
): Promise<{ success: boolean; message: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${supabaseUrl}/functions/v1/update-site-location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ site_id: siteId, latitude, longitude }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, message: data.error || "Gagal update lokasi" };
  return { success: true, message: data.message };
}

export type SiteOption = { id: string; name: string };

export async function getAllSites(): Promise<SiteOption[]> {
  const { data } = await supabase.from("sites").select("id, name").order("name");
  return (data || []) as SiteOption[];
}
