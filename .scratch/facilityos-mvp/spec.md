Status: ready-for-agent

# Spec: FacilityOS MVP — Smart Attendance & Bathroom Checkpoint System

## Problem Statement

Manajemen kebersihan gedung menghadapi tiga masalah: (1) absensi pekerja lapangan sulit diverifikasi — tidak ada bukti lokasi dan identitas real-time, (2) patroli kebersihan toilet tidak terdokumentasi — tidak diketahui apakah toilet sudah dibersihkan, kapan, dan oleh siapa, (3) pelanggaran SOP tidak terdeteksi dini — toilet yang tidak dibersihkan dalam 1 jam baru diketahui setelah ada keluhan.

## Solution

FacilityOS: platform manajemen fasilitas dengan dual-UI (mobile app untuk cleaner/supervisor, web dashboard untuk admin) yang menyediakan absensi GPS + selfie, patroli kebersihan toilet dengan bukti foto NFC/QR + before/after, dan pemantauan SOP 1-jam dengan alert escalation ke Telegram.

## User Stories

### Auth & Onboarding

1. Sebagai cleaner, saya ingin login dengan nomor HP via OTP, agar saya tidak perlu mengingat password.
2. Sebagai supervisor, saya ingin login dengan email dan password, agar saya bisa mengakses dari desktop dan mobile.
3. Sebagai admin, saya ingin login dengan email dan password, agar saya bisa mengelola sistem dari web dashboard.
4. Sebagai admin, saya ingin membuat site baru (nama, koordinat GPS, radius geofencing), agar sistem siap digunakan di lokasi baru.
5. Sebagai admin, saya ingin membuat checkpoint baru dalam sebuah site (nama, koordinat), agar toilet siap untuk patroli.
6. Sebagai supervisor, saya ingin melakukan pairing NFC tag ke checkpoint dengan men-tap tag fisik di lapangan menggunakan mobile app, agar saya tidak perlu input kode manual yang rawan typo.
7. Sebagai admin, saya ingin mencetak QR code untuk checkpoint sebagai fallback, agar checkpoint tetap bisa diakses meski NFC rusak atau device tidak mendukung NFC.
8. Sebagai admin, saya ingin menetapkan cleaner ke site tertentu, agar cleaner tahu di mana dia bertugas.
9. Sebagai admin, saya ingin memindahkan cleaner antar site, agar alokasi tenaga kerja fleksibel.

### Attendance (Cleaner Mobile)

10. Sebagai cleaner, saya ingin check-in dengan foto selfie dan validasi GPS, agar kehadiran saya tercatat dengan bukti lokasi dan visual.
11. Sebagai cleaner, saya ingin check-out dengan foto selfie dan validasi GPS, agar jam pulang saya tercatat dan total jam kerja terhitung.
12. Sebagai cleaner, saya ingin check-in/out per site (bukan per hari), agar saya bisa bertugas di site berbeda dalam satu hari.
13. Sebagai cleaner, saya ingin tetap bisa check-in saat di luar radius geofencing dengan memberikan alasan (override), agar GPS yang tidak akurat tidak menghalangi pekerjaan saya.
14. Sebagai cleaner, saya ingin melihat status hari ini — sudah check-in/belum, berapa checkpoint yang selesai, berapa pending sync — di layar utama mobile app, agar saya tahu progress kerja saya.

### Checkpoint Patrol (Cleaner Mobile)

15. Sebagai cleaner, saya ingin men-tap NFC tag di checkpoint untuk memulai sesi pembersihan, agar identifikasi checkpoint cepat dan akurat.
16. Sebagai cleaner, saya ingin scan QR code di checkpoint sebagai alternatif saat NFC tidak berfungsi, agar saya tetap bisa bekerja.
17. Sebagai cleaner, saya ingin mengambil foto "sebelum" setelah scan checkpoint, agar kondisi awal toilet terdokumentasi.
18. Sebagai cleaner, saya ingin mengambil foto "sesudah" untuk menyelesaikan sesi pembersihan, agar bukti penyelesaian tercatat.
19. Sebagai cleaner, saya ingin melihat riwayat sesi pembersihan saya hari ini, agar saya tahu checkpoint mana yang sudah dan belum dikerjakan.
20. Sebagai cleaner, saya ingin tetap bisa scan dan mengambil foto saat offline, agar sinyal lemah tidak menghentikan pekerjaan saya.
21. Sebagai cleaner, saya ingin melihat badge "N pending sync" di app saat ada data yang belum terkirim, agar saya tahu kapan harus mencari sinyal.

### SOP Monitoring & Alerting

22. Sebagai sistem, saya ingin mendeteksi checkpoint yang tidak di-scan dalam 1 jam terakhir, agar pelanggaran SOP teridentifikasi otomatis.
23. Sebagai sistem, saya ingin mengirim notifikasi in-app ke cleaner saat checkpoint belum di-scan dalam 1 jam, agar cleaner segera merespon.
24. Sebagai sistem, saya ingin mengirim alert via Telegram ke supervisor jika cleaner tidak merespon dalam 15 menit, agar masalah di-escalate.
25. Sebagai supervisor, saya ingin menerima alert Telegram saat ada eskalasi SOP, agar saya bisa segera tindak lanjut meski tidak membuka app.
26. Sebagai sistem, saya ingin otomatis membatalkan sesi checkpoint yang belum selesai saat cleaner check-out, agar tidak ada sesi menggantung.

### Supervisor Mobile

27. Sebagai supervisor, saya ingin melihat dashboard team saya — siapa sudah check-in, checkpoint mana yang sudah/belum selesai — dari mobile app, agar saya bisa memantau dari lapangan.
28. Sebagai supervisor, saya ingin melakukan inspeksi checkpoint dengan scan NFC/QR, menambah foto opsional dan catatan, agar saya bisa audit kualitas hasil kerja cleaner.
29. Sebagai supervisor, saya ingin melihat riwayat override geofencing cleaner, agar saya bisa review dan tindak lanjut.
30. Sebagai supervisor, saya ingin melihat riwayat inspeksi saya sendiri dan cleaner, agar saya bisa track audit.

### Admin Web Dashboard

31. Sebagai admin, saya ingin melihat dashboard multi-site — semua site dalam satu tampilan, agar saya bisa memonitor seluruh operasi.
32. Sebagai admin, saya ingin melihat tabel log attendance dengan filter (site, cleaner, tanggal, status override), agar saya bisa audit kehadiran.
33. Sebagai admin, saya ingin melihat tabel log checkpoint dengan filter (site, checkpoint, cleaner, status), agar saya bisa audit hasil patroli.
34. Sebagai admin, saya ingin melihat grafik completion rate checkpoint per site per hari, agar saya bisa identifikasi site bermasalah.
35. Sebagai admin, saya ingin mengekspor laporan attendance dan checkpoint ke CSV, agar saya bisa olah data di Excel.
36. Sebagai admin, saya ingin mengelola data user (tambah, edit, hapus, assign site), agar sistem selalu up-to-date.
37. Sebagai admin, saya ingin dashboard di-refresh otomatis setiap 30 detik, agar data yang saya lihat selalu terkini.

### Edge Cases & Robustness

38. Sebagai sistem, saya ingin menolak scan checkpoint jika cleaner belum check-in di site tersebut, agar tidak ada sesi pembersihan tanpa kehadiran tercatat.
39. Sebagai sistem, saya ingin mengompres foto ke max 1024px JPEG quality 70% sebelum upload, agar hemat bandwidth dan storage.
40. Sebagai cleaner, saya ingin melihat pesan jelas saat NFC tidak didukung device saya dan diarahkan ke QR, agar saya tidak bingung.

## Implementation Decisions

### Architecture

- **Monorepo** dengan tiga direktori: `/mobile` (React Native/Expo), `/web` (Next.js App Router), `/supabase` (Edge Functions + migrations)
- **Database**: Supabase PostgreSQL + PostGIS extension untuk spatial queries
- **Auth**: Hybrid — phone OTP (cleaner) + email/password (supervisor, admin)
- **Storage**: Supabase Storage untuk foto attendance dan checkpoint

### Schema Changes from Initial Design

- `attendance_logs.photo_url` dipecah jadi `check_in_photo_url` dan `check_out_photo_url`
- `attendance_logs` tambah kolom `override_reason` (TEXT) dan `is_flagged` (BOOLEAN)
- `checkpoint_logs.status` tambah value `expired`
- `checkpoint_logs` tambah kolom `log_type` (`cleaning` | `inspection`)
- `checkpoints` tambah kolom `display_order` (INT) untuk rekomendasi urutan
- `users` tambah kolom `phone` (VARCHAR)

### Mobile App

- **Bahasa**: Indonesia only di MVP
- **Layar utama cleaner**: status check-in, tombol besar check-in/out, tombol scan checkpoint (aktif hanya setelah check-in), list progress checkpoint, badge pending sync
- **NFC**: primary method untuk identifikasi checkpoint. App deteksi dukungan NFC device — jika tidak ada, langsung fallback ke QR scanner
- **Checkpoint flow**: scan NFC/QR → foto sebelum → sesi in_progress → foto sesudah → completed. Kedua foto wajib.
- **Geofencing override**: soft warning + passive approval — cleaner submit alasan, langsung bisa lanjut, event flagged untuk supervisor
- **Offline**: queue & sync — semua data disimpan lokal, auto-sync saat online. Badge "N pending sync" di UI
- **Foto**: compress ke max 1024px, JPEG 70% sebelum upload
- **Prasyarat scan**: harus sudah check-in di site terkait
- **Checkout**: otomatis tandai semua sesi in_progress sebagai expired

### Web Admin Dashboard

- **Dashboard multi-site**: overview semua site, tabel + chart (TanStack Table + Recharts)
- **Polling 30 detik**: auto-refresh data, bukan realtime WebSocket
- **Report**: attendance + checkpoint completion, export CSV
- **UI components**: Tailwind CSS, Shadcn UI, Lucide React icons
- **Site & checkpoint management**: CRUD via admin dashboard
- **User management**: CRUD user + assign site

### Supervisor Mobile

- **Dashboard tim**: lihat status cleaner dan checkpoint di site yang dipegang
- **Inspeksi**: scan checkpoint → foto opsional + catatan → tersimpan sebagai `log_type = inspection`
- **Override review**: lihat dan tindak lanjuti override event cleaner

### SOP Monitoring

- **Edge Function cron**: jalan setiap ~5 menit, query checkpoint yang `finished_at` > 1 jam lalu
- **Escalation**: alert pertama → in-app notification ke cleaner. 15 menit tanpa scan baru → alert Telegram ke supervisor
- **Alert channels**: in-app (Expo Notifications) untuk cleaner, Telegram Bot untuk supervisor

### Data Cleanup

- **Foto storage**: hapus setelah 6 bulan untuk kontrol biaya

## Testing Decisions

### Apa yang membuat test baik

Hanya test external behavior — bukan implementation detail. Test di level screen/page (mobile/web) dan Edge Function (backend). Verifikasi behavior dari perspektif user, bukan internal state.

### Seams yang ditest

| Seam | Scope | Framework |
|------|-------|-----------|
| Edge Functions | Setiap function: auth flow, check-in, scan, alerting | Supabase local + integration test |
| Mobile screens | Screen-level: check-in/out flow, scan checkpoint flow, offline queue | React Native Testing Library |
| Web dashboard pages | Page-level: tabel attendance, checkpoint log, filter, export | React Testing Library |
| Database RLS | Row Level Security: cleaner hanya lihat data sendiri | pgTAP / integration test |

### Critical path yang ditest di MVP

- **Happy path check-in/out** — GPS valid, foto terupload
- **Happy path scan checkpoint** — NFC/QR → before → after → completed
- **Geofencing override** — outside radius → alasan → flagged
- **Offline queue** — operasi offline → sync saat online
- **Auth RBAC** — cleaner tidak bisa akses endpoint admin
- **Prerequisite check** — scan ditolak jika belum check-in

### Prior art

Tidak ada — project greenfield. Struktur test mengikuti konvensi masing-masing framework.

## Out of Scope

- **WhatsApp alerting** — hanya Telegram di MVP
- **Real-time dashboard (WebSocket)** — pakai polling 30 detik
- **Map view di mobile cleaner** — dashboard sederhana saja
- **Multi-language (EN)** — Bahasa Indonesia only
- **PDF report generation** — CSV export saja
- **Face recognition / liveness detection** — foto selfie saja
- **Auto-delete foto storage** — implementasi di post-MVP
- **Turborepo / monorepo tooling** — struktur direktori sederhana
- **SOP compliance report** — enhancement, hanya attendance + checkpoint report di MVP
- **Checkpoint urutan wajib** — urutan bebas, display_order hanya rekomendasi

## Further Notes

- Semua istilah domain mengacu pada `CONTEXT.md`
- 4 ADRs sudah tercatat di `docs/adr/` untuk keputusan arsitektur kunci
- Schema migration dijalankan via Supabase CLI (`supabase migration new`)
- Shared TypeScript types antara mobile dan web untuk type safety di API contracts
