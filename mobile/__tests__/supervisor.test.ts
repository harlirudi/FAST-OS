/**
 * TDD ticket 08: Supervisor dashboard logic
 */

// ============================================================
// Team data aggregation
// ============================================================

type CleanerStatus = {
  id: string;
  name: string;
  checkedIn: boolean;
  lastCheckIn: string | null;
  completedCheckpoints: number;
  totalCheckpoints: number;
};

function buildTeamSummary(
  cleaners: Array<{ id: string; name: string }>,
  attendance: Array<{ userId: string; type: string; timestamp: string }>,
  checkpointProgress: Array<{ userId: string; completed: number; total: number }>
): CleanerStatus[] {
  return cleaners.map((cleaner) => {
    const logs = attendance.filter((a) => a.userId === cleaner.id);
    const lastCheckIn = logs.filter((l) => l.type === "check_in").sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
    const lastCheckOut = logs.filter((l) => l.type === "check_out").sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];

    const progress = checkpointProgress.find((p) => p.userId === cleaner.id) || {
      completed: 0,
      total: 0,
    };

    return {
      id: cleaner.id,
      name: cleaner.name,
      checkedIn: !!lastCheckIn && (!lastCheckOut || lastCheckIn.timestamp > lastCheckOut.timestamp),
      lastCheckIn: lastCheckIn?.timestamp ?? null,
      completedCheckpoints: progress.completed,
      totalCheckpoints: progress.total,
    };
  });
}

// ============================================================
// Inspection vs cleaning differentiation
// ============================================================

type CheckpointLog = {
  id: string;
  logType: "cleaning" | "inspection";
  userId: string;
  checkpointId: string;
  note?: string | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
};

function isInspection(log: CheckpointLog): boolean {
  return log.logType === "inspection";
}

function filterInspections(logs: CheckpointLog[]): CheckpointLog[] {
  return logs.filter(isInspection);
}

function filterCleaningSessions(logs: CheckpointLog[]): CheckpointLog[] {
  return logs.filter((l) => l.logType === "cleaning");
}

// ============================================================
// Override filter
// ============================================================

type AttendanceLog = {
  id: string;
  userId: string;
  type: string;
  isFlagged: boolean;
  overrideReason: string | null;
  timestamp: string;
  userName?: string;
};

function filterOverrides(logs: AttendanceLog[]): AttendanceLog[] {
  return logs.filter((l) => l.isFlagged === true);
}

function filterOverridesByDate(logs: AttendanceLog[], date: string): AttendanceLog[] {
  return logs.filter(
    (l) => l.isFlagged && l.timestamp.startsWith(date)
  );
}

// ============================================================
// Tests
// ============================================================

describe("Supervisor Dashboard (ticket 08 TDD)", () => {
  describe("buildTeamSummary", () => {
    const cleaners = [
      { id: "u1", name: "Andi" },
      { id: "u2", name: "Budi" },
    ];

    it("cleaner dengan check-in aktif → checkedIn: true", () => {
      const result = buildTeamSummary(
        cleaners,
        [{ userId: "u1", type: "check_in", timestamp: "2024-01-01T08:00:00Z" }],
        [{ userId: "u1", completed: 3, total: 5 }]
      );
      expect(result[0].checkedIn).toBe(true);
      expect(result[0].completedCheckpoints).toBe(3);
      expect(result[0].totalCheckpoints).toBe(5);
    });

    it("cleaner tanpa attendance → checkedIn: false", () => {
      const result = buildTeamSummary(cleaners, [], []);
      expect(result[0].checkedIn).toBe(false);
      expect(result[1].checkedIn).toBe(false);
    });

    it("cleaner check-out setelah check-in → checkedIn: false", () => {
      const result = buildTeamSummary(
        cleaners,
        [
          { userId: "u1", type: "check_in", timestamp: "2024-01-01T08:00:00Z" },
          { userId: "u1", type: "check_out", timestamp: "2024-01-01T17:00:00Z" },
        ],
        []
      );
      expect(result[0].checkedIn).toBe(false);
    });

    it("cleaner tanpa progress → completed: 0, total: 0", () => {
      const result = buildTeamSummary(
        cleaners,
        [{ userId: "u1", type: "check_in", timestamp: "2024-01-01T08:00:00Z" }],
        []
      );
      expect(result[0].completedCheckpoints).toBe(0);
      expect(result[0].totalCheckpoints).toBe(0);
    });
  });

  describe("Inspection vs Cleaning", () => {
    const logs: CheckpointLog[] = [
      { id: "l1", logType: "cleaning", userId: "u1", checkpointId: "c1" },
      { id: "l2", logType: "inspection", userId: "u2", checkpointId: "c1", note: "Lantai basah" },
    ];

    it("filterInspections — hanya inspection", () => {
      const result = filterInspections(logs);
      expect(result).toHaveLength(1);
      expect(result[0].logType).toBe("inspection");
    });

    it("filterCleaningSessions — hanya cleaning", () => {
      const result = filterCleaningSessions(logs);
      expect(result).toHaveLength(1);
      expect(result[0].logType).toBe("cleaning");
    });

    it("isInspection — true untuk logType inspection", () => {
      expect(isInspection(logs[1])).toBe(true);
      expect(isInspection(logs[0])).toBe(false);
    });
  });

  describe("Override filter", () => {
    const logs: AttendanceLog[] = [
      { id: "a1", userId: "u1", type: "check_in", isFlagged: false, overrideReason: null, timestamp: "2024-01-01T08:00:00Z" },
      { id: "a2", userId: "u2", type: "check_in", isFlagged: true, overrideReason: "GPS tidak akurat", timestamp: "2024-01-01T09:00:00Z" },
      { id: "a3", userId: "u3", type: "check_in", isFlagged: true, overrideReason: "Di dalam gedung", timestamp: "2024-01-02T08:00:00Z" },
    ];

    it("filterOverrides — hanya flagged", () => {
      const result = filterOverrides(logs);
      expect(result).toHaveLength(2);
      expect(result.every((l) => l.isFlagged)).toBe(true);
    });

    it("filterOverridesByDate — flagged + tanggal spesifik", () => {
      const result = filterOverridesByDate(logs, "2024-01-01");
      expect(result).toHaveLength(1);
      expect(result[0].overrideReason).toBe("GPS tidak akurat");
    });

    it("filterOverrides — array kosong jika tidak ada flagged", () => {
      const result = filterOverrides([logs[0]]);
      expect(result).toHaveLength(0);
    });
  });
});
