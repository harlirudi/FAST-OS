/**
 * TDD ticket 09: Dashboard & reports logic
 */

// ============================================================
// Completion rate
// ============================================================

type SiteCompletion = {
  siteId: string;
  siteName: string;
  completed: number;
  total: number;
};

function calcCompletionRate(site: SiteCompletion): number {
  if (site.total === 0) return 0;
  return Math.round((site.completed / site.total) * 100);
}

function calcGlobalCompletionRate(sites: SiteCompletion[]): number {
  const totalCompleted = sites.reduce((sum, s) => sum + s.completed, 0);
  const totalCheckpoints = sites.reduce((sum, s) => sum + s.total, 0);
  if (totalCheckpoints === 0) return 0;
  return Math.round((totalCompleted / totalCheckpoints) * 100);
}

// ============================================================
// CSV generation
// ============================================================

function generateCSV(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.join(",");
  const body = rows
    .map((row) => columns.map((col) => {
      const val = row[col] ?? "";
      const str = String(val);
      return str.includes(",") ? `"${str}"` : str;
    }).join(","))
    .join("\n");
  return header + "\n" + body;
}

function downloadCSV(filename: string, csv: string): { filename: string; content: string } {
  return { filename, content: csv };
}

// ============================================================
// Filter matching
// ============================================================

type AttendanceRow = {
  id: string;
  userName: string;
  siteName: string;
  type: string;
  timestamp: string;
  isFlagged: boolean;
};

function filterAttendance(
  rows: AttendanceRow[],
  filters: { site?: string; type?: string; date?: string; flagged?: boolean }
): AttendanceRow[] {
  return rows.filter((row) => {
    if (filters.site && row.siteName !== filters.site) return false;
    if (filters.type && row.type !== filters.type) return false;
    if (filters.date && !row.timestamp.startsWith(filters.date)) return false;
    if (filters.flagged !== undefined && row.isFlagged !== filters.flagged) return false;
    return true;
  });
}

// ============================================================
// Tests
// ============================================================

describe("Dashboard & Reports (ticket 09 TDD)", () => {
  describe("calcCompletionRate", () => {
    it("100% completion", () => {
      expect(calcCompletionRate({ siteId: "s1", siteName: "A", completed: 5, total: 5 })).toBe(100);
    });

    it("0% completion", () => {
      expect(calcCompletionRate({ siteId: "s1", siteName: "A", completed: 0, total: 5 })).toBe(0);
    });

    it("0 total → 0%", () => {
      expect(calcCompletionRate({ siteId: "s1", siteName: "A", completed: 0, total: 0 })).toBe(0);
    });

    it("partial 60%", () => {
      expect(calcCompletionRate({ siteId: "s1", siteName: "A", completed: 3, total: 5 })).toBe(60);
    });

    it("global rate across sites", () => {
      const sites: SiteCompletion[] = [
        { siteId: "s1", siteName: "A", completed: 3, total: 5 },
        { siteId: "s2", siteName: "B", completed: 2, total: 5 },
      ];
      expect(calcGlobalCompletionRate(sites)).toBe(50);
    });
  });

  describe("generateCSV", () => {
    it("menghasilkan CSV sederhana", () => {
      const csv = generateCSV(
        ["nama", "role"],
        [{ nama: "Andi", role: "cleaner" }, { nama: "Budi", role: "supervisor" }]
      );
      expect(csv).toBe("nama,role\nAndi,cleaner\nBudi,supervisor");
    });

    it("escape koma dalam nilai", () => {
      const csv = generateCSV(
        ["nama", "alasan"],
        [{ nama: "Andi", alasan: "GPS tidak akurat, sinyal lemah" }]
      );
      expect(csv).toBe('nama,alasan\nAndi,"GPS tidak akurat, sinyal lemah"');
    });

    it("handle nilai kosong", () => {
      const csv = generateCSV(["nama", "role"], [{ nama: "Andi", role: null }]);
      expect(csv).toBe("nama,role\nAndi,");
    });

    it("downloadCSV mengembalikan objek", () => {
      const result = downloadCSV("attendance.csv", "a,b\n1,2");
      expect(result.filename).toBe("attendance.csv");
      expect(result.content).toBe("a,b\n1,2");
    });
  });

  describe("filterAttendance", () => {
    const rows: AttendanceRow[] = [
      { id: "a1", userName: "Andi", siteName: "Gedung A", type: "check_in", timestamp: "2024-01-01T08:00:00Z", isFlagged: false },
      { id: "a2", userName: "Budi", siteName: "Gedung B", type: "check_in", timestamp: "2024-01-01T09:00:00Z", isFlagged: true },
      { id: "a3", userName: "Andi", siteName: "Gedung A", type: "check_out", timestamp: "2024-01-02T17:00:00Z", isFlagged: false },
    ];

    it("filter by site", () => {
      const result = filterAttendance(rows, { site: "Gedung B" });
      expect(result).toHaveLength(1);
      expect(result[0].userName).toBe("Budi");
    });

    it("filter by type", () => {
      const result = filterAttendance(rows, { type: "check_out" });
      expect(result).toHaveLength(1);
    });

    it("filter by date", () => {
      const result = filterAttendance(rows, { date: "2024-01-02" });
      expect(result).toHaveLength(1);
    });

    it("filter by flagged", () => {
      const result = filterAttendance(rows, { flagged: true });
      expect(result).toHaveLength(1);
      expect(result[0].isFlagged).toBe(true);
    });

    it("multiple filters", () => {
      const result = filterAttendance(rows, { site: "Gedung A", type: "check_in" });
      expect(result).toHaveLength(1);
    });

    it("no filters → all rows", () => {
      expect(filterAttendance(rows, {})).toHaveLength(3);
    });
  });
});
