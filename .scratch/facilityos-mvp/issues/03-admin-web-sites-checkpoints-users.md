# 03 — Admin web: sites, checkpoints & users

**What to build:** Web admin dashboard (Next.js) untuk CRUD sites, checkpoints, dan users. Termasuk NFC pairing flow oleh supervisor via mobile.

**Blocked by:** 01 — Database schema + seed, 02 — Auth system (hybrid + RBAC)

**Status:** ready-for-agent

- [ ] Admin bisa membuat, mengedit, menghapus sites (nama, koordinat GPS, radius)
- [ ] Admin bisa membuat, mengedit, menghapus checkpoints dalam site (nama, koordinat, display_order)
- [ ] Admin bisa membuat, mengedit, menghapus users (nama, role, assign ke site)
- [ ] Admin bisa assign dan reassign cleaner ke site
- [ ] Halaman NFC pairing: admin input NFC tag ID manual ke checkpoint
- [ ] UI: Shadcn UI form + TanStack Table untuk list sites/checkpoints/users
- [ ] Test: CRUD sites, checkpoints, users via React Testing Library
- [ ] Test: RLS enforcement — non-admin tidak bisa akses halaman ini
