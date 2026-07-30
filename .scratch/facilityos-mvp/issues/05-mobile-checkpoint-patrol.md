# 05 — Mobile: checkpoint patrol

**What to build:** Mobile app untuk cleaner — scan NFC/QR checkpoint, ambil foto before/after, selesaikan sesi pembersihan. Termasuk Edge Function API untuk checkpoint logs.

**Blocked by:** 01 — Database schema + seed, 02 — Auth system (hybrid + RBAC), 03 — Admin web: sites, checkpoints & users

**Status:** ready-for-agent

- [ ] Cleaner tap NFC tag → identifikasi checkpoint → mulai sesi cleaning (in_progress)
- [ ] NFC tidak didukung → otomatis fallback ke QR scanner → kamera scan QR code
- [ ] Ambil foto "sebelum" (wajib) → kompres → upload ke storage
- [ ] Ambil foto "sesudah" (wajib) → kompres → upload → status completed, duration_minutes tercatat
- [ ] Scan ditolak jika cleaner belum check-in di site checkpoint terkait
- [ ] List riwayat sesi pembersihan hari ini (sudah/belum selesai)
- [ ] Tombol scan hanya aktif setelah check-in
- [ ] Test: happy path NFC → before photo → after photo → completed
- [ ] Test: QR fallback saat NFC tidak tersedia
- [ ] Test: scan ditolak jika belum check-in
