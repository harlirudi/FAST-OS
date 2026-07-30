# 01 — Database schema + seed

**What to build:** Supabase migration untuk seluruh schema FacilityOS — sites, users, checkpoints, attendance_logs, checkpoint_logs — termasuk PostGIS extension, Row Level Security, dan seed data untuk development.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Migrasi membuat semua 5 tabel dengan kolom lengkap (termasuk perubahan hasil grilling: check_in_photo_url/check_out_photo_url, override_reason, is_flagged, log_type, expired, display_order, phone)
- [ ] PostGIS extension aktif
- [ ] Foreign key constraints dan CHECK constraints sesuai spec
- [ ] RLS policies: cleaner hanya baca/tulis data sendiri, supervisor baca team di site yang sama, admin akses penuh
- [ ] Seed data: minimal 2 sites, 4 checkpoints, 3 users (1 cleaner, 1 supervisor, 1 admin)
- [ ] `supabase db reset` membersihkan dan re-migrate tanpa error
