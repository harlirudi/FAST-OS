Status: ready-for-agent

# Tech Debt — FacilityOS MVP

## Hasil Code Review

### Belum difix (post-MVP)
| Item | Prioritas | Detail |
|------|-----------|--------|
| NFC pairing via supervisor mobile | Rendah | Saat ini hanya admin web, spec minta supervisor pairing di lapangan |
| In-app notification SOP cleaner | Rendah | SOP alert langsung ke Telegram, belum ada push notif ke cleaner |
| QR code printing/download | Rendah | Admin web belum bisa ekspor/cetak QR code |
| Duplicated table components | Rendah | AttendanceTable & CheckpointTable ~90% struktur sama |
| Primitive obsession | Rendah | String union `"nfc"\|"qr"`, role, status tersebar tanpa enum terpusat |
| Data clumps | Rendah | `{latitude, longitude}` di 8+ call site |
| Shotgun surgery | Rendah | Tambah SyncAction = edit 4 file, ubah role = edit 7 file |
| Divergent change | Rendah | admin-actions.ts campur 4 domain, sync.ts campur 4 concern |
| Mysterious names | Rendah | `s` sebagai styles, destruct 1-char `t,o,p,i` |
| Middle man functions | Rendah | admin-only/index.ts 17-line pass-through, getUserFromToken 1-liner |
| Tab "Foto" di supervisor dashboard | Rendah | Scope creep — spec tidak minta foto gallery |

## Test Coverage
| Tipe | Jumlah |
|------|--------|
| Unit test (mobile) | 45 |
| Unit test (web) | 17 |
| Integration test | 13 |
| **Total** | **75** |
