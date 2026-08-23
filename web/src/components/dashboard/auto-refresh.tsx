"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Muat ulang halaman secara berkala supaya status penugasan
// terbaru (dari admin) muncul tanpa refresh manual.
export default function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
