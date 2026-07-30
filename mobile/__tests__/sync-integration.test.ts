import AsyncStorage from "@react-native-async-storage/async-storage";
import { enqueue, getPendingCount, getPendingItems, syncAll } from "../lib/sync";

jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  // Hapus .setter hack — ganti dengan mock items biasa
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

describe("Offline → Online Integration", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("check-in offline kemudian bisa disinkron", async () => {
    // Simulasi offline: enqueue check-in
    await enqueue({
      type: "check_in" as const,
      payload: { latitude: -6.2088, longitude: 106.8456, photoUrl: "http://selfie.jpg" },
      createdAt: new Date().toISOString(),
    });

    expect(await getPendingCount()).toBe(1);

    const items = await getPendingItems();
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Check-In");
    expect(items[0].synced).toBe(false);
  });

  it("checkpoint_complete offline tersimpan dengan status lokal", async () => {
    await enqueue({
      type: "checkpoint_complete" as const,
      payload: { sessionId: "sesi-1", photoUrl: "http://after.jpg", latitude: 1, longitude: 1 },
      createdAt: new Date().toISOString(),
    });

    const items = await getPendingItems();
    expect(items[0].label).toBe("Selesai Sesi");
    expect(items[0].synced).toBe(false);
  });

  it("conflict resolution: last-write-wins untuk foto duplikat", async () => {
    // Simulasi: upload foto before yang sama dua kali
    await enqueue({
      type: "checkpoint_photo" as const,
      payload: { sessionId: "sesi-1", photoType: "before", photoUrl: "http://foto1.jpg" },
      createdAt: "2024-01-01T08:00:00Z",
    });
    await enqueue({
      type: "checkpoint_photo" as const,
      payload: { sessionId: "sesi-1", photoType: "before", photoUrl: "http://foto2.jpg" },
      createdAt: "2024-01-01T08:01:00Z",
    });

    // Seharusnya hanya 1 item (yang terbaru)
    expect(await getPendingCount()).toBe(1);
    const items = await getPendingItems();
    expect(items[0].synced).toBe(false);
  });

  it("syncAll tidak sinkron saat offline", async () => {
    await enqueue({
      type: "check_in" as const,
      payload: { latitude: 1, longitude: 1, photoUrl: "x" },
      createdAt: new Date().toISOString(),
    });

    const synced = await syncAll();
    expect(synced).toBe(0);
    expect(await getPendingCount()).toBe(1);
  });
});
