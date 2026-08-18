"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const supabase = createClient();
  const isFirstRender = useRef(true);

  const fetchData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) {
        setLoading(true);
      }
      try {
        const data = await fetchFn(supabase, filters);
        setRows(data);
      } catch (err) {
        console.error(`Error fetching table data for ${tableName}:`, err);
      } finally {
        if (!isSilent) {
          setLoading(false);
        }
      }
    },
    [filters, supabase, fetchFn, tableName]
  );

  // Fetch when filters change or on initial mount
  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Background polling every 30s silently (no skeleton/loading state flicker)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  return { rows, loading, filters, setFilters, exportCSV, refresh: () => fetchData(false) };
}
