# NFC primary, QR fallback untuk identifikasi checkpoint

Checkpoint diidentifikasi melalui NFC tag sebagai primary method, QR code sebagai fallback. NFC lebih cepat untuk patroli harian (tap & go). QR disediakan untuk device tanpa NFC atau saat tag NFC rusak. Mobile app mendeteksi dukungan NFC device — jika tidak ada, langsung fallback ke QR.

**Considered Options:**
- **QR only** — lebih sederhana dan universal, tapi lebih lambat (harus buka kamera, fokus, scan) dan kurang nyaman untuk patroli rutin.
- **NFC only** — eksklusi device murah yang tidak memiliki NFC reader.
