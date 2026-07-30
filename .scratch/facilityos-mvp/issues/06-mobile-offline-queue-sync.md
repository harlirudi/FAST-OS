# 06 — Mobile: offline queue & sync

**What to build:** Offline support untuk mobile app — check-in, scan checkpoint, dan foto disimpan lokal saat offline, auto-sync saat koneksi pulih.

**Blocked by:** 04 — Mobile: attendance (check-in/out), 05 — Mobile: checkpoint patrol

**Status:** ready-for-agent

- [ ] Data check-in/out disimpan lokal (SQLite/AsyncStorage) saat offline
- [ ] Data scan checkpoint + foto disimpan lokal saat offline
- [ ] Auto-detect koneksi — saat online, antrian diproses FIFO
- [ ] Badge "N pending sync" di UI mobile
- [ ] Indikator per-item di history: "Tersimpan lokal" vs "Tersinkron"
- [ ] Conflict resolution: data yang lebih baru menang (last-write-wins)
- [ ] Test: check-in offline → online → data tersinkron ke server
- [ ] Test: scan checkpoint offline dengan foto → online → foto terupload
