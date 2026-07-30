import AsyncStorage from "@react-native-async-storage/async-storage";
import { enqueue, getPendingCount, getPendingActions, syncAll, onPendingChange } from "../lib/sync";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
    clear: jest.fn(async () => { store = {}; }),
  };
});

// Mock NetInfo
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => () => {}),
}));

describe("Sync Queue", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe("enqueue", () => {
    it("menambahkan action ke antrian", async () => {
      const action = {
        type: "check_in" as const,
        payload: { latitude: -6.2, longitude: 106.8, photoUrl: "http://foto.jpg" },
        createdAt: new Date().toISOString(),
      };

      await enqueue(action);
      const count = await getPendingCount();
      expect(count).toBe(1);
    });

    it("memproses antrian secara FIFO", async () => {
      await enqueue({
        type: "check_in" as const,
        payload: { latitude: 1, longitude: 1, photoUrl: "a" },
        createdAt: "2024-01-01T08:00:00Z",
      });
      await enqueue({
        type: "check_out" as const,
        payload: { latitude: 2, longitude: 2, photoUrl: "b" },
        createdAt: "2024-01-01T17:00:00Z",
      });

      const actions = await getPendingActions();
      expect(actions).toHaveLength(2);
      expect(actions[0].type).toBe("check_in");
      expect(actions[1].type).toBe("check_out");
    });

    it("notifikasi listener saat antrian berubah", async () => {
      const callback = jest.fn();
      const unsub = onPendingChange(callback);

      await enqueue({
        type: "check_in" as const,
        payload: { latitude: 1, longitude: 1, photoUrl: "x" },
        createdAt: new Date().toISOString(),
      });

      expect(callback).toHaveBeenCalledWith(1);
      unsub();
    });
  });

  describe("getPendingCount", () => {
    it("mengembalikan 0 saat antrian kosong", async () => {
      expect(await getPendingCount()).toBe(0);
    });

    it("mengembalikan jumlah item yang tepat", async () => {
      await enqueue({
        type: "check_in" as const,
        payload: { latitude: 1, longitude: 1, photoUrl: "a" },
        createdAt: new Date().toISOString(),
      });
      await enqueue({
        type: "checkpoint_start" as const,
        payload: { identifier: "TAG1", mode: "nfc", latitude: 1, longitude: 1 },
        createdAt: new Date().toISOString(),
      });
      expect(await getPendingCount()).toBe(2);
    });
  });

  describe("syncAll", () => {
    it("syncAll mengembalikan 0 saat offline", async () => {
      const synced = await syncAll();
      expect(synced).toBe(0);
    });
  });
});
