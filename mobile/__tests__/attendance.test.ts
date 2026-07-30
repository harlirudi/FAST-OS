/**
 * Test retro ticket 04: Attendance service
 *
 * Menguji pure logic dari attendance:
 * - deteksi status check-in berdasarkan log attendance
 * - fallback saat data tidak tersedia
 */

describe("Attendance Logic (ticket 04 retro)", () => {
  // Pure logic: menentukan apakah user sedang checked-in
  function isUserCheckedIn(logs: Array<{ type: string; timestamp: string }>): boolean {
    if (!logs || logs.length === 0) return false;
    const sorted = [...logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const last = sorted[0];
    return last.type === "check_in";
  }

  it("checkedIn: false jika tidak ada log", () => {
    expect(isUserCheckedIn([])).toBe(false);
  });

  it("checkedIn: true jika log terakhir check_in", () => {
    expect(
      isUserCheckedIn([{ type: "check_in", timestamp: "2024-01-01T08:00:00Z" }])
    ).toBe(true);
  });

  it("checkedIn: false jika log terakhir check_out", () => {
    expect(
      isUserCheckedIn([
        { type: "check_in", timestamp: "2024-01-01T08:00:00Z" },
        { type: "check_out", timestamp: "2024-01-01T17:00:00Z" },
      ])
    ).toBe(false);
  });

  it("checkedIn: true jika check-in baru setelah check-out lama", () => {
    expect(
      isUserCheckedIn([
        { type: "check_out", timestamp: "2024-01-01T12:00:00Z" },
        { type: "check_in", timestamp: "2024-01-01T13:00:00Z" },
      ])
    ).toBe(true);
  });

  it("checkedIn: false jika check-out setelah check-in terbaru", () => {
    expect(
      isUserCheckedIn([
        { type: "check_in", timestamp: "2024-01-01T08:00:00Z" },
        { type: "check_out", timestamp: "2024-01-01T17:00:00Z" },
        { type: "check_in", timestamp: "2024-01-02T08:00:00Z" },
        { type: "check_out", timestamp: "2024-01-02T17:30:00Z" },
      ])
    ).toBe(false);
  });
});
