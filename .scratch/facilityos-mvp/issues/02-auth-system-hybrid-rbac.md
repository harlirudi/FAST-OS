# 02 — Auth system (hybrid + RBAC)

**What to build:** Sistem autentikasi hybrid — cleaner login via phone OTP, supervisor & admin login via email+password. Role-based access control mencegah cleaner mengakses endpoint admin.

**Blocked by:** 01 — Database schema + seed

**Status:** ready-for-agent

- [ ] Cleaner bisa register/login dengan nomor HP + OTP (via Supabase Phone Auth)
- [ ] Supervisor dan admin bisa register/login dengan email + password
- [ ] Role disimpan di `users` table dan disinkron ke Supabase JWT claims
- [ ] Middleware/guard di Edge Functions menolak request dengan role tidak sesuai
- [ ] Middleware/guard di Next.js web menolak akses halaman admin untuk non-admin
- [ ] Middleware/guard di React Native mengarahkan user ke screen sesuai role
- [ ] Test: cleaner tidak bisa akses endpoint admin; supervisor tidak bisa akses manage users
