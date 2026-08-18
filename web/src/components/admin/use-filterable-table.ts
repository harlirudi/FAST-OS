"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type FilterState = Record<string, string>;

type FetchFn<T> = (
  supabase: ReturnType<typeof createClient>,
  filters: FilterState
) => Promise<T[]>;

export function useFilterableTable<T>(
  tableName: string,
  fetchFn: FetchFn<T>,
  filterDefs: FilterState = {}
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(filterDefs);

  // Stabilkan client supabase — dibuat sekali saja (jangan tiap render)
  const supabase = useMemo(() => createClient(), []);

  // Simpan fetchFn terbaru di ref agar tidak memicu re-run effect
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const runFetch = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      try {
        const data = await fetchFnRef.current(supabase, filters);
        setRows(data);
      } catch (err) {
        console.error(`Error fetching table data for ${tableName}:`, err);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    // Hanya bergantung pada nilai yang benar-benar mengubah hasil fetch
    [supabase, filters, tableName]
  );

  // Fetch saat mount atau saat filter berubah
  useEffect(() => {
    runFetch(false);
  }, [runFetch]);

  // Background polling 30 detik secara hening (tanpa skeleton/flicker)
  useEffect(() => {
    const interval = setInterval(() => {
      runFetch(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [runFetch]);

  const exportCSV = (headers: string[], rowMapper: (r: T) => string, filename: string) => {
    const body = rows.map(rowMapper).join("\n");
    const blob = new Blob([headers.join(",") + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { rows, loading, filters, setFilters, exportCSV, refresh: () => runFetch(false) };
}
