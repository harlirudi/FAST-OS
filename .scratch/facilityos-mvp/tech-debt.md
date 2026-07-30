Status: ready-for-agent

# Tech Debt — FacilityOS MVP

## Sudah difix
| Item | Commit |
|------|--------|
| ✅ SOP detection cek in_progress stale | `e8cbb39` |
| ✅ Foto selfie dari kamera asli + kompresi | `e8cbb39` |
| ✅ Session start with before_photo_url | `e8cbb39` |
| ✅ Extract haversineDistance ke _shared/geo.ts | `e8cbb39` |
| ✅ Dashboard stats auto-refresh | `e8cbb39` |
| ✅ Pesan NFC tidak didukung | `e8cbb39` |
| ✅ Shared types (Role, LogStatus, GeoPoint, dll) | `HEAD` |
| ✅ Split admin-actions.ts per domain | `HEAD` |
| ✅ Hapus admin-only/index.ts (middle man) | `HEAD` |

## Belum difix (post-MVP)
| Item | Prioritas | Detail |
|------|-----------|--------|
| NFC pairing via supervisor mobile | Rendah | Butuh hardware NFC + flow mobile |
| In-app notification SOP cleaner | Rendah | Butuh Expo Push setup |
| QR code printing/export | Rendah | Admin web belum bisa cetak QR |
| Duplicated table components | Rendah | AttendanceTable & CheckpointTable ~90% sama |
| Shotgun surgery | Rendah | Tambah SyncAction = edit 4 file |
| Mysterious names | Rendah | `s` sebagai styles di SupervisorDashboardScreen |
