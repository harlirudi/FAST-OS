import AsyncStorage from "@react-native-async-storage/async-storage";
import { enqueue, getPendingCount, getPendingItems, syncAll } from "../lib/sync";

jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
    clear: jest.fn(async () => { store = {}; }),
  };
});

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => () => {}),
}));

// Mock Supabase
jest.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
  supabaseUrl: "http://localhost",
}));

describe("Offline → Online Integration", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("check-in offline kemudian bisa disinkron", async () => {
    await enqueue("check_in", { latitude: -6.2088, longitude: 106.8456, photoUrl: "http://selfie.jpg" });

    expect(await getPendingCount()).toBe(1);

    const items = await getPendingItems();
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Check-In");
    expect(items[0].synced).toBe(false);
  });

  it("checkpoint_complete offline tersimpan dengan status lokal", async () => {
    await enqueue("checkpoint_complete", { sessionId: "sesi-1", photoUrl: "http://after.jpg", latitude: 1, longitude: 1 });

    const items = await getPendingItems();
    expect(items[0].label).toBe("Selesai Sesi");
    expect(items[0].synced).toBe(false);
  });

  it("conflict resolution: last-write-wins untuk foto duplikat", async () => {
    await enqueue("checkpoint_photo", { sessionId: "sesi-1", photoType: "before", photoUrl: "http://foto1.jpg" });
    await enqueue("checkpoint_photo", { sessionId: "sesi-1", photoType: "before", photoUrl: "http://foto2.jpg" });

    expect(await getPendingCount()).toBe(1);
    const items = await getPendingItems();
    expect(items[0].synced).toBe(false);
  });

  it("syncAll tidak sinkron saat offline", async () => {
    await enqueue("check_in", { latitude: 1, longitude: 1, photoUrl: "x" });

    const synced = await syncAll();
    expect(synced).toBe(0);
    expect(await getPendingCount()).toBe(1);
  });
});
