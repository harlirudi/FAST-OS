/**
 * Test retro ticket 05: Checkpoint service
 */

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => () => {}),
}));

import { parseQrCode } from "../lib/checkpoint";

describe("Checkpoint Logic (ticket 05 retro)", () => {
  describe("parseQrCode", () => {
    it("mengenali format qr_<hash>", () => {
      expect(parseQrCode("qr_toilet_l1_pria")).toBe("qr_toilet_l1_pria");
    });

    it("mengenali format plain hash sebagai QR", () => {
      expect(parseQrCode("abc123def")).toBe("abc123def");
    });

    it("tidak mengubah format khusus QR", () => {
      expect(parseQrCode("qr_utama_l1_wanita")).toBe("qr_utama_l1_wanita");
    });
  });

  describe("validasi prerequisite check-in", () => {
    function canStartSession(
      lastCheckIn: { type: string; timestamp: string } | undefined,
      lastCheckOut: { type: string; timestamp: string } | undefined
    ): boolean {
      if (!lastCheckIn) return false;
      if (!lastCheckOut) return true;
      return new Date(lastCheckIn.timestamp) > new Date(lastCheckOut.timestamp);
    }

    it("tolak jika belum check-in", () => {
      expect(canStartSession(undefined, undefined)).toBe(false);
    });

    it("izinkan jika hanya check-in tanpa check-out", () => {
      expect(
        canStartSession(
          { type: "check_in", timestamp: "2024-01-01T08:00:00Z" },
          undefined
        )
      ).toBe(true);
    });

    it("izinkan jika check-in setelah check-out terakhir", () => {
      expect(
        canStartSession(
          { type: "check_in", timestamp: "2024-01-01T09:00:00Z" },
          { type: "check_out", timestamp: "2024-01-01T07:00:00Z" }
        )
      ).toBe(true);
    });

    it("tolak jika check-out setelah check-in terakhir", () => {
      expect(
        canStartSession(
          { type: "check_in", timestamp: "2024-01-01T08:00:00Z" },
          { type: "check_out", timestamp: "2024-01-01T17:00:00Z" }
        )
      ).toBe(false);
    });
  });

  describe("durasi sesi", () => {
    function calculateDuration(startedAt: string, finishedAt: string): number {
      return Math.round(
        (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000
      );
    }

    it("durasi 30 menit", () => {
      expect(
        calculateDuration("2024-01-01T08:00:00Z", "2024-01-01T08:30:00Z")
      ).toBe(30);
    });

    it("durasi 0 menit", () => {
      expect(
        calculateDuration("2024-01-01T08:00:00Z", "2024-01-01T08:00:00Z")
      ).toBe(0);
    });

    it("durasi 120 menit (2 jam)", () => {
      expect(
        calculateDuration("2024-01-01T08:00:00Z", "2024-01-01T10:00:00Z")
      ).toBe(120);
    });
  });
});
