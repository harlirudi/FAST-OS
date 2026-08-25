"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { geocodePlace } from "@/lib/geocode";

type GeocodeResult = {
  lat: number;
  lng: number;
  display_name: string;
};

// Pencarian lokasi via Google Geocoding API (server-side, key tidak bocor).
// UI minimal: satu kolom cari + daftar hasil.
export function LocationSearch({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const data = await geocodePlace(query.trim());
      setResults(data);
      if (data.length === 0) setError("Lokasi tidak ditemukan. Coba kata kunci lain.");
    } catch (e: any) {
      setError(e?.message || "Gagal mencari lokasi");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
          placeholder="Cari nama tempat — mis. Phi Cafe"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="shrink-0 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          <Search className="mr-1 inline h-3.5 w-3.5" />
          {searching ? "Mencari..." : "Cari"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-1">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onPick(r.lat, r.lng);
                setResults([]);
                setQuery("");
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-blue-50"
            >
              {r.display_name}
              <span className="block text-[10px] text-gray-400">
                {r.lat.toFixed(6)}, {r.lng.toFixed(6)}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
