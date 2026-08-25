-- Role SECURITY: divisi keamanan dengan checkpoint sendiri (type),
-- satu supervisor site mengawasi kedua tim (cleaner + security).

-- 1) checkpoints.type
ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'cleaning';
CREATE INDEX IF NOT EXISTS idx_checkpoints_site_type ON checkpoints(site_id, type);

-- 2) RLS checkpoints: cleaner & security hanya melihat type masing-masing;
--    supervisor melihat semua type di site-nya.
DROP POLICY IF EXISTS "Cleaner read checkpoints in own site" ON checkpoints;
CREATE POLICY "Cleaner read checkpoints in own site" ON checkpoints FOR SELECT
  USING (site_id = get_user_site_id() AND type = 'cleaning');

DROP POLICY IF EXISTS "Security read checkpoints in own site" ON checkpoints;
CREATE POLICY "Security read checkpoints in own site" ON checkpoints FOR SELECT
  USING (get_user_role() = 'security' AND site_id = get_user_site_id() AND type = 'security');

-- 3) attendance_logs: security bisa absensi sendiri (seperti cleaner)
DROP POLICY IF EXISTS "Security CRUD own attendance" ON attendance_logs;
CREATE POLICY "Security CRUD own attendance" ON attendance_logs FOR ALL
  USING (
    get_user_role() = 'security'
    AND user_id = get_user_internal_id()
  );

-- 4) checkpoint_logs: security bisa mencatat log checkpoint sendiri
DROP POLICY IF EXISTS "Security CRUD own checkpoint logs" ON checkpoint_logs;
CREATE POLICY "Security CRUD own checkpoint logs" ON checkpoint_logs FOR ALL
  USING (
    get_user_role() = 'security'
    AND user_id = get_user_internal_id()
  );
