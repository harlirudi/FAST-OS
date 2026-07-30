ALTER TABLE attendance_logs ALTER COLUMN check_in_photo_url DROP NOT NULL;
ALTER TABLE attendance_logs ALTER COLUMN check_out_photo_url DROP NOT NULL;

ALTER TABLE attendance_logs ADD CONSTRAINT check_in_photo_required
  CHECK (type != 'check_in' OR check_in_photo_url IS NOT NULL);

ALTER TABLE attendance_logs ADD CONSTRAINT check_out_photo_required
  CHECK (type != 'check_out' OR check_out_photo_url IS NOT NULL);
