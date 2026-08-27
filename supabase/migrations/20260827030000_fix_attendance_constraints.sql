-- ============================================================
-- Fix: constraint attendance_logs yang kontradiktif dengan desain
-- 1. Foto HANYA untuk record flagged (Batch 1) — constraint lama mewajibkan foto
--    tiap check_in/check_out → semua absensi normal gagal "Gagal menyimpan absensi".
-- 2. Type check belum menyertakan break_start/break_end (Batch 3) → istirahat gagal.
-- ============================================================

ALTER TABLE attendance_logs DROP CONSTRAINT IF EXISTS check_in_photo_required;
ALTER TABLE attendance_logs DROP CONSTRAINT IF EXISTS check_out_photo_required;

ALTER TABLE attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_type_check;
ALTER TABLE attendance_logs ADD CONSTRAINT attendance_logs_type_check
  CHECK (type IN ('check_in', 'check_out', 'break_start', 'break_end'));
