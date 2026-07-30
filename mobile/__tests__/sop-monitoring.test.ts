/**
 * TDD ticket 07: SOP Monitoring logic
 *
 * Pure logic di-test dulu sebelum implementasi.
 */

// ============================================================
// Deteksi checkpoint overdue (> 1 jam sejak terakhir selesai)
// ============================================================

type CheckpointState = {
  id: string;
  name: string;
  siteId: string;
  lastFinishedAt: string | null; // ISO string atau null (belum pernah)
};

function findOverdueCheckpoints(
  checkpoints: CheckpointState[],
  now: Date,
  thresholdMs: number
): CheckpointState[] {
  return checkpoints.filter((cp) => {
    if (!cp.lastFinishedAt) return true; // belum pernah di-scan → overdue
    const elapsed = now.getTime() - new Date(cp.lastFinishedAt).getTime();
    return elapsed > thresholdMs;
  });
}

// ============================================================
// Escalation timer (15 menit sejak alert pertama)
// ============================================================

type AlertState = {
  checkpointId: string;
  firstAlertAt: string | null; // kapan alert pertama dikirim
  escalated: boolean;
};

function shouldEscalate(
  alert: AlertState,
  now: Date,
  escalationMs: number
): boolean {
  if (alert.escalated) return false;
  if (!alert.firstAlertAt) return false;
  const elapsed = now.getTime() - new Date(alert.firstAlertAt).getTime();
  return elapsed >= escalationMs;
}

// ============================================================
// Ack: scan checkpoint → reset timer
// ============================================================

function ackReset(
  alerts: AlertState[],
  checkpointId: string
): AlertState[] {
  return alerts.map((a) =>
    a.checkpointId === checkpointId
      ? { ...a, firstAlertAt: null, escalated: false }
      : a
  );
}

// ============================================================
// Tests
// ============================================================

describe("SOP Monitoring (ticket 07 TDD)", () => {
  const ONE_HOUR = 60 * 60 * 1000;
  const FIFTEEN_MIN = 15 * 60 * 1000;

  describe("findOverdueCheckpoints", () => {
    const checkpoints: CheckpointState[] = [
      { id: "c1", name: "Toilet Lt.1", siteId: "s1", lastFinishedAt: null },
      { id: "c2", name: "Toilet Lt.2", siteId: "s1", lastFinishedAt: new Date().toISOString() },
    ];

    it("checkpoint belum pernah di-scan → overdue", () => {
      const now = new Date();
      const result = findOverdueCheckpoints([checkpoints[0]], now, ONE_HOUR);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
    });

    it("checkpoint baru selesai → tidak overdue", () => {
      const now = new Date();
      const result = findOverdueCheckpoints([checkpoints[1]], now, ONE_HOUR);
      expect(result).toHaveLength(0);
    });

    it("checkpoint selesai 2 jam lalu → overdue", () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * ONE_HOUR).toISOString();
      const result = findOverdueCheckpoints(
        [{ ...checkpoints[0], lastFinishedAt: twoHoursAgo }],
        now,
        ONE_HOUR
      );
      expect(result).toHaveLength(1);
    });

    it("checkpoint selesai 30 menit lalu → tidak overdue (masih dalam threshold)", () => {
      const now = new Date();
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const result = findOverdueCheckpoints(
        [{ ...checkpoints[0], lastFinishedAt: thirtyMinAgo }],
        now,
        ONE_HOUR
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("shouldEscalate", () => {
    it("belum ada alert → tidak escalate", () => {
      const alert: AlertState = { checkpointId: "c1", firstAlertAt: null, escalated: false };
      expect(shouldEscalate(alert, new Date(), FIFTEEN_MIN)).toBe(false);
    });

    it("alert baru dikirim → tidak escalate (belum 15 menit)", () => {
      const now = new Date();
      const alert: AlertState = {
        checkpointId: "c1",
        firstAlertAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        escalated: false,
      };
      expect(shouldEscalate(alert, now, FIFTEEN_MIN)).toBe(false);
    });

    it("alert dikirim 20 menit lalu → escalate", () => {
      const now = new Date();
      const alert: AlertState = {
        checkpointId: "c1",
        firstAlertAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        escalated: false,
      };
      expect(shouldEscalate(alert, now, FIFTEEN_MIN)).toBe(true);
    });

    it("sudah escalated → tidak escalate lagi", () => {
      const now = new Date();
      const alert: AlertState = {
        checkpointId: "c1",
        firstAlertAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        escalated: true,
      };
      expect(shouldEscalate(alert, now, FIFTEEN_MIN)).toBe(false);
    });
  });

  describe("ackReset", () => {
    it("scan checkpoint → reset timer + batalkan escalation", () => {
      const alerts: AlertState[] = [
        { checkpointId: "c1", firstAlertAt: "2024-01-01T08:00:00Z", escalated: true },
        { checkpointId: "c2", firstAlertAt: "2024-01-01T08:00:00Z", escalated: false },
      ];

      const result = ackReset(alerts, "c1");
      expect(result[0].firstAlertAt).toBeNull();
      expect(result[0].escalated).toBe(false);
      // c2 tidak berubah
      expect(result[1].firstAlertAt).toBe("2024-01-01T08:00:00Z");
    });

    it("ID tidak ditemukan → array tidak berubah", () => {
      const alerts: AlertState[] = [
        { checkpointId: "c1", firstAlertAt: "2024-01-01T08:00:00Z", escalated: false },
      ];
      const result = ackReset(alerts, "c99");
      expect(result[0].firstAlertAt).toBe("2024-01-01T08:00:00Z");
    });
  });
});
