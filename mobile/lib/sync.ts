import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

const QUEUE_KEY = "sync_queue";

export type SyncAction =
  | { type: "check_in"; payload: { latitude: number; longitude: number; photoUrl: string; reason?: string }; createdAt: string; synced?: boolean }
  | { type: "check_out"; payload: { latitude: number; longitude: number; photoUrl: string }; createdAt: string; synced?: boolean }
  | { type: "checkpoint_start"; payload: { identifier: string; mode: "nfc" | "qr"; latitude: number; longitude: number }; createdAt: string; synced?: boolean }
  | { type: "checkpoint_photo"; payload: { sessionId: string; photoType: "before" | "after"; photoUrl: string }; createdAt: string; synced?: boolean }
  | { type: "checkpoint_complete"; payload: { sessionId: string; photoUrl: string; latitude: number; longitude: number }; createdAt: string; synced?: boolean };

export type PendingItem = {
  type: string;
  label: string;
  createdAt: string;
  synced: boolean;
};

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

  // Conflict resolution: last-write-wins — hapus duplikat untuk tipe yang sama
  const duplicateIdx = queue.findIndex((a) =>
    a.type === action.type &&
    a.type === "checkpoint_photo" &&
    "sessionId" in a.payload && "sessionId" in action.payload &&
    a.payload.sessionId === action.payload.sessionId &&
    a.payload.photoType === (action.payload as { photoType: string }).photoType
  );

  if (duplicateIdx >= 0) {
    queue[duplicateIdx] = { ...action, synced: false };
  } else {
    queue.push({ ...action, synced: false });
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notify(queue.filter((a) => !a.synced).length);
}

export async function getPendingCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  return JSON.parse(raw).filter((a: SyncAction) => !a.synced).length;
}

export async function getPendingItems(): Promise<PendingItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  const queue: SyncAction[] = JSON.parse(raw);

  const labels: Record<string, string> = {
    check_in: "Check-In",
    check_out: "Check-Out",
    checkpoint_start: "Mulai Sesi",
    checkpoint_photo: "Upload Foto",
    checkpoint_complete: "Selesai Sesi",
  };

  return queue.map((a) => ({
    type: a.type,
    label: labels[a.type] || a.type,
    createdAt: a.createdAt,
    synced: !!a.synced,
  }));
}

export async function getPendingActions(): Promise<SyncAction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  return JSON.parse(raw).filter((a: SyncAction) => !a.synced);
}

export async function syncAll(): Promise<number> {
  if (!online) return 0;

  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;

  const queue: SyncAction[] = JSON.parse(raw);
  let synced = 0;

  // FIFO: proses berurutan
  for (const action of queue) {
    if (action.synced) continue;

    try {
      await processAction(action);
      action.synced = true;
      synced++;
    } catch {
      // Gagal — tetap di antrian untuk retry
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notify(queue.filter((a) => !a.synced).length);
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
          override_reason: action.type === "check_in" ? (action.payload as { reason?: string }).reason : undefined,
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

initNetworkListener();
