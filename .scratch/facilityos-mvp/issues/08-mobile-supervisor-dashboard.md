# 08 — Mobile: supervisor dashboard

**What to build:** Mobile app view untuk supervisor — dashboard team, inspeksi checkpoint dengan foto+catan, review override.

**Blocked by:** 01 — Database schema + seed, 02 — Auth system (hybrid + RBAC), 04 — Mobile: attendance (check-in/out), 05 — Mobile: checkpoint patrol

**Status:** ready-for-agent

- [ ] Supervisor lihat dashboard team: list cleaner di site, status check-in, progress checkpoint
- [ ] Supervisor scan NFC/QR checkpoint → mode inspeksi (bukan cleaning session)
- [ ] Supervisor tambah foto opsional + catatan teks → tersimpan sebagai log_type = inspection
- [ ] Supervisor lihat riwayat inspeksi sendiri
- [ ] Supervisor lihat riwayat override geofencing cleaner (flagged events)
- [ ] Supervisor bisa lihat foto before/after dari sesi cleaner terakhir di tiap checkpoint
- [ ] Test: supervisor inspection scan → foto + catatan tersimpan terpisah dari cleaning session
- [ ] Test: override list tampil dan bisa difilter
