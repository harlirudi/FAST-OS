import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

const QUEUE_KEY = "sync_queue";

// Action registry — tambah entry di sini untuk action baru (satu tempat)
type ActionPayloads = {
  check_in: { latitude: number; longitude: number; photoUrl: string; reason?: string };
  check_out: { latitude: number; longitude: number; photoUrl: string };
  checkpoint_start: { identifier: string; mode: "nfc" | "qr"; latitude: number; longitude: number };
  checkpoint_photo: { sessionId: string; photoType: "before" | "after"; photoUrl: string };
  checkpoint_complete: { sessionId: string; photoUrl: string; latitude: number; longitude: number };
};

type ActionTypes = keyof ActionPayloads;

type QueuedAction = {
  type: ActionTypes;
  payload: ActionPayloads[ActionTypes];
  createdAt: string;
  synced?: boolean;
};

type ActionHandler = (payload: any, token: string) => Promise<void>;

const handlers: Record<ActionTypes, { label: string; handler: ActionHandler }> = {
  check_in: {
    label: "Check-In",
    handler: async (p, token) => {
      const { supabaseUrl } = await import("./supabase");
      const res = await fetch(`${supabaseUrl}/functions/v1/attendance`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "check_in", latitude: p.latitude, longitude: p.longitude, photo_url: p.photoUrl, override_reason: p.reason }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
  },
  check_out: {
    label: "Check-Out",
    handler: async (p, token) => {
      const { supabaseUrl } = await import("./supabase");
      const res = await fetch(`${supabaseUrl}/functions/v1/attendance`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "check_out", latitude: p.latitude, longitude: p.longitude, photo_url: p.photoUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
  },
  checkpoint_start: {
    label: "Mulai Sesi",
    handler: async (p, token) => {
      const { supabaseUrl } = await import("./supabase");
      const res = await fetch(`${supabaseUrl}/functions/v1/checkpoint`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "start", nfc_tag_id: p.mode === "nfc" ? p.identifier : undefined, qr_code_hash: p.mode === "qr" ? p.identifier : undefined, latitude: p.latitude, longitude: p.longitude }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
  },
  checkpoint_photo: {
    label: "Upload Foto",
    handler: async (p, token) => {
      const { supabaseUrl } = await import("./supabase");
      const res = await fetch(`${supabaseUrl}/functions/v1/checkpoint`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "photo", session_id: p.sessionId, photo_type: p.photoType, photo_url: p.photoUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
  },
  checkpoint_complete: {
    label: "Selesai Sesi",
    handler: async (p, token) => {
      const { supabaseUrl } = await import("./supabase");
      const res = await fetch(`${supabaseUrl}/functions/v1/checkpoint`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "complete", session_id: p.sessionId, photo_url: p.photoUrl, latitude: p.latitude, longitude: p.longitude }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
  },
};

let online = true;
let listeners: Array<(count: number) => void> = [];

export function onPendingChange(cb: (count: number) => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function notify(count: number) { listeners.forEach((l) => l(count)); }

export function isOnline(): boolean { return online; }

export function initNetworkListener() {
  NetInfo.addEventListener((state: NetInfoState) => {
    const wasOffline = !online;
    online = !!(state.isConnected && state.isInternetReachable !== false);
    if (wasOffline && online) syncAll();
  });
}

export async function enqueue(type: ActionTypes, payload: ActionPayloads[ActionTypes]): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: QueuedAction[] = raw ? JSON.parse(raw) : [];

  // Conflict resolution: last-write-wins untuk foto duplikat
  if (type === "checkpoint_photo") {
    const p = payload as ActionPayloads["checkpoint_photo"];
    const dup = queue.findIndex((a) => a.type === "checkpoint_photo" && (a.payload as ActionPayloads["checkpoint_photo"]).sessionId === p.sessionId && (a.payload as ActionPayloads["checkpoint_photo"]).photoType === p.photoType);
    if (dup >= 0) { queue[dup] = { type, payload, createdAt: new Date().toISOString(), synced: false }; }
    else { queue.push({ type, payload, createdAt: new Date().toISOString(), synced: false }); }
  } else {
    queue.push({ type, payload, createdAt: new Date().toISOString(), synced: false });
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notify(queue.filter((a) => !a.synced).length);
}

export async function getPendingCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw).filter((a: QueuedAction) => !a.synced).length : 0;
}

export type PendingItem = { type: string; label: string; createdAt: string; synced: boolean };

export async function getPendingItems(): Promise<PendingItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  return JSON.parse(raw).map((a: QueuedAction) => ({
    type: a.type,
    label: handlers[a.type]?.label || a.type,
    createdAt: a.createdAt,
    synced: !!a.synced,
  }));
}

export async function syncAll(): Promise<number> {
  if (!online) return 0;
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;

  const queue: QueuedAction[] = JSON.parse(raw);
  let synced = 0;
  const { supabase } = await import("./supabase");
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return 0;

  for (const action of queue) {
    if (action.synced) continue;
    try {
      await handlers[action.type].handler(action.payload, token);
      action.synced = true;
      synced++;
    } catch {}
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notify(queue.filter((a) => !a.synced).length);
  return synced;
}

initNetworkListener();
