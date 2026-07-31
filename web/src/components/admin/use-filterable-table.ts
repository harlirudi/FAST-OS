"use client";

import { useState, useEffect, useCallback } from "react";
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const data = await fetchFn(supabase, filters);
    setRows(data);
    setLoading(false);
  }, [filters, supabase, fetchFn]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const exportCSV = (headers: string[], rowMapper: (r: T) => string, filename: string) => {
    const body = rows.map(rowMapper).join("\n");
    const blob = new Blob([headers.join(",") + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { rows, loading, filters, setFilters, exportCSV };
}
