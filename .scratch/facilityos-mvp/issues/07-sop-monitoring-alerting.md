# 07 — SOP monitoring & alerting

**What to build:** Edge Function cron yang memonitor checkpoint setiap ~5 menit, mengirim alert escalation saat checkpoint tidak di-scan dalam 1 jam.

**Blocked by:** 01 — Database schema + seed, 04 — Mobile: attendance (check-in/out), 05 — Mobile: checkpoint patrol

**Status:** ready-for-agent

- [ ] Edge Function cron berjalan setiap 5 menit via Supabase scheduled function
- [ ] Query: checkpoint dengan finished_at > 1 jam lalu atau belum pernah di-scan
- [ ] Alert pertama: in-app notification ke cleaner (Expo Push Notifications)
- [ ] 15 menit tanpa scan baru → escalate: alert Telegram ke supervisor site terkait
- [ ] Telegram bot terdaftar dan supervisor disubscribe (via /start command bot)
- [ ] Setiap scan checkpoint mengirim ack agar escalation timer reset
- [ ] Test: checkpoint tidak di-scan 1 jam → alert ke cleaner → 15 menit → alert Telegram
- [ ] Test: scan checkpoint dalam 15 menit → escalation batal
