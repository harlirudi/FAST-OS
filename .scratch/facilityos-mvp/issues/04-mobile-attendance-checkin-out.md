# 04 — Mobile: attendance (check-in/out)

**What to build:** Mobile app (React Native) untuk cleaner — check-in dan check-out dengan GPS geofencing, foto selfie, dan override. Termasuk Edge Function API untuk attendance.

**Blocked by:** 01 — Database schema + seed, 02 — Auth system (hybrid + RBAC)

**Status:** ready-for-agent

- [ ] Cleaner bisa check-in: GPS divalidasi terhadap radius site, foto selfie (kamera), data tersimpan
- [ ] Cleaner bisa check-out: GPS divalidasi, foto selfie, data tersimpan, sesi in_progress expired
- [ ] Tampilan tombol besar Check-In / Check-Out (berganti sesuai status)
- [ ] GPS di luar radius → muncul warning, cleaner input alasan (override) → tetap bisa check-in → event flagged
- [ ] Foto dikompres ke max 1024px JPEG 70% sebelum upload
- [ ] Status bar di layar utama: "Sudah check-in" / "Belum check-in", progress checkpoint
- [ ] Test: happy path check-in dengan GPS valid + foto terupload
- [ ] Test: override flow — outside radius → alasan → flagged → tetap bisa lanjut
- [ ] Test: check-out → semua sesi in_progress jadi expired
