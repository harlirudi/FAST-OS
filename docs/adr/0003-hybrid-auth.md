# Hybrid authentication — phone OTP untuk cleaner, email+password untuk admin/supervisor

Cleaner login via phone OTP karena mayoritas tidak memiliki email kerja dan lebih familiar dengan nomor HP. Admin dan supervisor login via email+password — mereka desktop user dengan email perusahaan. Supabase Auth mendukung kedua metode.

**Considered Options:**
- **Email+password untuk semua** — mengasumsikan semua user punya email, tidak realistis untuk pekerja lapangan di Indonesia.
- **Phone OTP untuk semua** — tidak efisien untuk admin/supervisor yang bekerja dari desktop, dan menambah biaya SMS.
