-- Role security: perbarui check constraint users.role
-- (constraint lama hanya izinkan cleaner/supervisor/admin)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('cleaner','supervisor','admin','security'));

-- Jam mulai kerja per site (untuk deteksi keterlambatan check-in)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS start_time VARCHAR(5) DEFAULT '08:00';
