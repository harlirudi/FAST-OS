-- Foto patokan wajah per user untuk verifikasi check-in/check-out (face matching)
ALTER TABLE users ADD COLUMN IF NOT EXISTS reference_photo_url VARCHAR(500);
