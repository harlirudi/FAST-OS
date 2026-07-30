# Offline mode dengan queue & sync

Mobile app mendukung operasi offline penuh — data check-in, scan checkpoint, dan foto disimpan lokal (SQLite/AsyncStorage) lalu auto-sync saat koneksi pulih. Foto diunggah ke Supabase Storage saat sync, bukan real-time. UI menampilkan badge "N pending sync".

**Consequences:**
- Menambah kompleksitas di mobile app (queue management, conflict resolution).
- Foto tidak tersedia di dashboard sampai sync selesai — supervisor mungkin melihat data tertunda.

**Considered Options:**
- **Online only** — gagal di lapangan karena sinyal indoor sering lemah.
- **Partial offline (hanya scan)** — membatasi fungsionalitas dan membingungkan user tentang apa yang bisa/tidak bisa dilakukan offline.
