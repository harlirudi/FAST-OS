# Monorepo structure

FacilityOS menggunakan monorepo tunggal (`FAST-HENDRA-OS`) dengan tiga sub-direktori: `/mobile` (React Native/Expo), `/web` (Next.js), `/supabase` (Edge Functions + migrations). Satu repo untuk schema migrations, shared TypeScript types, dan koordinasi ticket development.

**Considered Options:**
- **Multi-repo** — repositori terpisah per aplikasi. Ditolak karena menyulitkan koordinasi schema changes dan shared types antar platform.
- **Monorepo dengan Turborepo** — tooling terlalu berat untuk MVP dua app. Ditunda sebagai enhancement.
