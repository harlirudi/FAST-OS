# FacilityOS

Platform manajemen fasilitas AI-native untuk operasional kebersihan gedung — absensi pekerja lapangan berbasis GPS, patroli kebersihan toilet dengan bukti foto, dan pemantauan SOP real-time.

## Language

### Sites & Locations

**Site**:
Lokasi operasional atau gedung tempat pekerja bertugas. Memiliki koordinat GPS dan radius geofencing.
_Avoid_: Gedung, bangunan, cabang, lokasi

**Checkpoint**:
Titik inspeksi spesifik di dalam sebuah site, biasanya toilet atau area kebersihan. Diidentifikasi via NFC tag atau QR code.
_Avoid_: Titik inspeksi, area, zone, stall

**Geofencing**:
Batas virtual berbasis GPS dengan radius tertentu dari titik pusat site. Digunakan untuk validasi absensi.
_Avoid_: Geoboundary, virtual perimeter

### Users & Roles

**Cleaner**:
Pekerja lapangan yang melakukan absensi dan patroli kebersihan di checkpoint. Login via phone OTP, menggunakan mobile app.
_Avoid_: Petugas, cleaning service, operator

**Supervisor**:
Pengawas yang memantau performa cleaner di site. Bisa melakukan inspeksi checkpoint dan override geofencing. Menggunakan mobile app (dashboard) dan menerima alert via Telegram.
_Avoid_: Pengawas, mandor, team lead

**Admin**:
Pengelola sistem dengan akses penuh — mengelola site, checkpoint, user, dan NFC tag via web dashboard. Login via email+password.
_Avoid_: Manajemen, executive, system admin

### Attendance

**Check-In**:
Perekaman kehadiran cleaner di site — memvalidasi lokasi GPS terhadap geofencing site dan merekam foto selfie. Wajib dilakukan sebelum scan checkpoint.
_Avoid_: Absen masuk, clock-in, punch-in

**Check-Out**:
Perekaman akhir kehadiran — otomatis membatalkan semua sesi checkpoint yang belum selesai. Wajib dilakukan.
_Avoid_: Absen pulang, clock-out, punch-out

**Override**:
Pembatalan aturan geofencing oleh cleaner dengan alasan (misal GPS tidak akurat). Event ini ditandai untuk review supervisor di dashboard.
_Avoid_: Bypass, exception, force check-in

### Checkpoint Patrol

**Cleaning Session**:
Sesi pembersihan satu checkpoint oleh satu cleaner — dimulai dengan scan NFC/QR + foto "sebelum", diakhiri dengan foto "sesudah". Status: in_progress, completed, atau expired.
_Avoid_: Pembersihan, patrol, job, task

**Before Photo**:
Foto kondisi checkpoint sebelum dibersihkan. Wajib sebagai bukti awal sesi.
_Avoid_: Foto awal, pre-cleaning photo

**After Photo**:
Foto kondisi checkpoint setelah dibersihkan. Wajib sebagai bukti penyelesaian sesi.
_Avoid_: Foto akhir, post-cleaning photo

**Inspection**:
Scan checkpoint oleh supervisor untuk audit — foto opsional + catatan. Bukan cleaning session. Tercatat dengan tipe terpisah di log.
_Avoid_: Supervisory check, audit patrol

**NFC Tag**:
Chip fisik yang ditempel di checkpoint sebagai identifikasi utama. Ditap dengan mobile device untuk memulai sesi.
_Avoid_: NFC chip, tag, proximity card

**QR Code**:
Kode batang dua dimensi sebagai identifikasi fallback checkpoint saat NFC tidak tersedia atau rusak.
_Avoid_: Barcode, 2D code

### Monitoring

**SOP Monitoring**:
Pemantauan otomatis interval pembersihan checkpoint — alert terpicu jika checkpoint tidak di-scan dalam 1 jam sejak sesi terakhir.
_Avoid_: Schedule check, SLA monitoring

**Escalation**:
Alert bertingkat — pertama ke cleaner (in-app notification), jika tidak direspon dalam 15 menit, escalate ke supervisor via Telegram.
_Avoid_: Alert forwarding, notification chain

**Expired Session**:
Sesi pembersihan yang dibatalkan otomatis saat cleaner check-out tanpa menyelesaikan foto "sesudah".
_Avoid_: Abandoned session, incomplete job

### Sync

**Pending Sync**:
Data yang tersimpan lokal di device karena offline, menunggu koneksi untuk dikirim ke server. Ditampilkan sebagai badge di mobile app.
_Avoid_: Offline queue, local cache, unsent data
