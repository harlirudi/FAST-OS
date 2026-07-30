import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

const QUEUE_KEY = "sync_queue";

export type SyncAction =
  | { type: "check_in"; payload: { latitude: number; longitude: number; photoUrl: string; reason?: string }; createdAt: string }
  | { type: "check_out"; payload: { latitude: number; longitude: number; photoUrl: string }; createdAt: string }
  | { type: "checkpoint_start"; payload: { identifier: string; mode: "nfc" | "qr"; latitude: number; longitude: number }; createdAt: string }
  | { type: "checkpoint_photo"; payload: { sessionId: string; photoType: "before" | "after"; photoUrl: string }; createdAt: string }
  | { type: "checkpoint_complete"; payload: { sessionId: string; photoUrl: string; latitude: number; longitude: number }; createdAt: string };

let online = true;
let listeners: Array<(count: number) => void> = [];

export function onPendingChange(cb: (count: number) => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function notify(count: number) {
  listeners.forEach((l) => l(count));
}

export function isOnline(): boolean {
  return online;
}

export function initNetworkListener() {
  NetInfo.addEventListener((state: NetInfoState) => {
    const wasOffline = !online;
    online = !!(state.isConnected && state.isInternetReachable !== false);
    if (wasOffline && online) {
      syncAll();
    }
  });
}

export async function enqueue(action: SyncAction): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: SyncAction[] = raw ? JSON.parse(raw) : [];
  queue.push(action);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notify(queue.length);
}

export async function getPendingCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  return JSON.parse(raw).length;
}

export async function getPendingActions(): Promise<SyncAction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function syncAll(): Promise<number> {
  if (!online) return 0;

  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;

  const queue: SyncAction[] = JSON.parse(raw);
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining: SyncAction[] = [];

  for (const action of queue) {
    try {
      await processAction(action);
      synced++;
    } catch {
      // Kalau gagal, simpan kembali untuk retry
      remaining.push(action);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  notify(remaining.length);
  return synced;
}

async function processAction(action: SyncAction): Promise<void> {
  const { supabase, supabaseUrl } = await import("./supabase");
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("No session");

  switch (action.type) {
    case "check_in":
    case "check_out": {
      const res = await fetch(`${supabaseUrl}/functions/v1/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: action.type,
          latitude: action.payload.latitude,
          longitude: action.payload.longitude,
          photo_url: action.payload.photoUrl,
          override_reason: action.type === "check_in" ? action.payload.reason : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      break;
    }

    case "checkpoint_start": {
      const res = await fetch(`${supabaseUrl}/functions/v1/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "start",
          nfc_tag_id: action.payload.mode === "nfc" ? action.payload.identifier : undefined,
          qr_code_hash: action.payload.mode === "qr" ? action.payload.identifier : undefined,
          latitude: action.payload.latitude,
          longitude: action.payload.longitude,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      break;
    }

    case "checkpoint_photo": {
      const res = await fetch(`${supabaseUrl}/functions/v1/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "photo",
          session_id: action.payload.sessionId,
          photo_type: action.payload.photoType,
          photo_url: action.payload.photoUrl,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      break;
    }

    case "checkpoint_complete": {
      const res = await fetch(`${supabaseUrl}/functions/v1/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "complete",
          session_id: action.payload.sessionId,
          photo_url: action.payload.photoUrl,
          latitude: action.payload.latitude,
          longitude: action.payload.longitude,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      break;
    }
  }
}

// Startup: init network listener
initNetworkListener();
