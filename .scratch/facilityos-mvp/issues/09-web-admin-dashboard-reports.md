# 09 — Web admin: dashboard & reports

**What to build:** Web admin dashboard — multi-site overview dengan chart dan tabel yang bisa difilter, plus export CSV.

**Blocked by:** 01 — Database schema + seed, 02 — Auth system (hybrid + RBAC), 03 — Admin web: sites, checkpoints & users, 04 — Mobile: attendance (check-in/out), 05 — Mobile: checkpoint patrol

**Status:** ready-for-agent

- [ ] Dashboard overview multi-site: total cleaner, checkpoint completion rate, active sessions
- [ ] Tabel attendance log dengan filter: site, cleaner, tanggal, status override
- [ ] Tabel checkpoint log dengan filter: site, checkpoint, cleaner, status (completed/in_progress/expired)
- [ ] Chart completion rate checkpoint per site per hari (Recharts)
- [ ] Tabel dan chart auto-refresh setiap 30 detik
- [ ] Tombol export CSV untuk attendance log dan checkpoint log
- [ ] UI: TanStack Table + Recharts + Shadcn UI components
- [ ] Test: tabel attendance difilter → data sesuai
- [ ] Test: export CSV → file terdownload dengan kolom sesuai
