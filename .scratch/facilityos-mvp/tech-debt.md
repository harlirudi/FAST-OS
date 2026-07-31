Status: needs-triage

# Tech Debt — FacilityOS MVP

## Sudah difix
| Item |
|------|
| ✅ SOP detection cek in_progress stale |
| ✅ Foto selfie dari kamera asli + kompresi |
| ✅ Session start with before_photo_url |
| ✅ Extract haversineDistance ke _shared/geo.ts |
| ✅ Dashboard stats auto-refresh 30 detik |
| ✅ Pesan NFC tidak didukung |
| ✅ Shared types (Role, LogStatus, GeoPoint) |
| ✅ Split admin-actions.ts per domain |
| ✅ Hapus admin-only/index.ts (middle man) |
| ✅ Rename s → styles, destruct jelas |
| ✅ Nested button di DialogTrigger |
| ✅ RLS supervisor baca cleaner di site sendiri |
| ✅ Storage RLS policies upload foto |
| ✅ Downgrade Expo SDK 57 → 54 |
| ✅ Upload foto via FileSystem.uploadAsync (native) |
| ✅ Override tidak trigger kamera ulang |
| ✅ Sesi in_progress bisa diklik untuk melanjutkan |
| ✅ Foto supervisor mobile tampil via Image component |
| ✅ Foto web dashboard tampil di modal overlay |
| ✅ Duplicated table components → useFilterableTable hook |
| ✅ Shotgun surgery → SyncAction registry pattern |

## Belum difix

### Refactor (selesai)
| Item | Status |
|------|--------|
| Duplicated table components | ✅ useFilterableTable hook |
| Shotgun surgery (SyncAction) | ✅ registry pattern |

### Fitur (butuh infra — post-MVP)
| Item | Kendala |
|------|---------|
| NFC pairing via supervisor mobile | Butuh NFC native module di dev build |
| In-app push notification SOP cleaner | Butuh Expo Push + FCM/APNs cert |
| QR code printing/export | Fitur cetak QR di web admin |

## Test Coverage
| Tipe | Jumlah |
|------|--------|
| Unit test (mobile) | 45 |
| Unit test (web) | 17 |
| Integration test | 13 |
| **Total** | **75** |

## Catatan
- Semua flow bisnis terverifikasi di production (Supabase Cloud + Vercel)
- Foto upload berfungsi di Android via `FileSystem.uploadAsync`
- Dev build Android untuk development cepat (hot reload)
- Production build untuk rilis final
