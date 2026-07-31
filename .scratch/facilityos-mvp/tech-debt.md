Status: ready-for-agent

# Tech Debt — FacilityOS MVP

## Sudah difix (Kode)
| Item | Commit |
|------|--------|
| ✅ SOP detection cek in_progress stale | `e8cbb39` |
| ✅ Foto selfie dari kamera asli + kompresi | `e8cbb39` |
| ✅ Session start with before_photo_url | `e8cbb39` |
| ✅ Extract haversineDistance ke _shared/geo.ts | `e8cbb39` |
| ✅ Dashboard stats auto-refresh | `e8cbb39` |
| ✅ Pesan NFC tidak didukung | `e8cbb39` |
| ✅ Shared types (Role, LogStatus, GeoPoint) | `733b0fd` |
| ✅ Split admin-actions.ts per domain | `733b0fd` |
| ✅ Hapus admin-only/index.ts (middle man) | `733b0fd` |
| ✅ Rename s → styles, destruct jelas | `733b0fd` |
| ✅ Nested button di DialogTrigger | `37008fd` |
| ✅ RLS supervisor baca cleaner di site sendiri | `b9f29a5` |
| ✅ Storage RLS policies upload foto | `cce9a69` |
| ✅ Downgrade Expo SDK 57 → 54 (iOS compat) | `f2b5e16` |

## Belum difix

### Kode (refactor/arsitektur)
| Item | Prioritas |
|------|-----------|
| Duplicated table components (~90% sama) | Rendah |
| Shotgun surgery (SyncAction = 4 file) | Rendah |
| `dbReset` menghapus semua data (perlu seed script) | Rendah |

### Fitur (butuh infra/hardware)
| Item | Prioritas | Kendala |
|------|-----------|---------|
| Upload foto dari iPhone (fetch blob gagal) | Tinggi | Butuh EAS Build Android/iOS |
| NFC pairing via supervisor mobile | Rendah | Butuh NFC hardware + flow mobile |
| In-app push notification SOP cleaner | Rendah | Butuh Expo Push + FCM/APNs cert |
| QR code printing/export | Rendah | Fitur cetak QR di web admin |

### Testing (kamera di-skip untuk Expo Go)
| Item | Catatan |
|------|---------|
| Camera + upload di attendance | ⚠️ Skip, pakai placeholder URL |
| Camera + upload di checkpoint session | ⚠️ Skip, pakai placeholder URL |
| Edge Functions mati saat stop/start | ⚠️ Butuh terminal terpisah `supabase functions serve` |
| 35 test (mobile) + 17 test (web) + 13 integration | ✅ 75 total test |

## Rekomendasi Urutan Pengerjaan
1. EAS Build Android → test foto + upload nyata
2. Duplicated table components refactor
3. SyncAction refactor (Shotgun surgery)
4. NFC pairing via supervisor mobile
5. In-app push notification
