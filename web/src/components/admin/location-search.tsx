"use client";

import { useState } from "react";
import { Search, MapPin } from "lucide-react";

type GeocodeResult = {
  lat: string;
  lon: string;
  display_name: string;
};

// Mengambil koordinat dari link Google Maps (Share → Copy link):
//   https://maps.google.com/?q=-6.8712,107.5903
//   https://www.google.com/maps/@-6.8712,107.5903,17z
function parseGoogleMapsLink(url: string): { lat: number; lng: number } | null {
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  return null;
}

// Pencarian lokasi:
//   1) Cari nama tempat via Nominatim (OpenStreetMap) — cakupan terbatas di Indonesia
//   2) Buka Google Maps → cari → Share → Copy link → tempel di bawah → koordinat terisi
export function LocationSearch({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [mapsLink, setMapsLink] = useState("");

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=id&q=${encodeURIComponent(query.trim())}`
      );
      if (!res.ok) throw new Error("Gagal mencari lokasi");
      const data = (await res.json()) as GeocodeResult[];
      setResults(data);
      if (data.length === 0) {
        setError(
          "Tidak ditemukan di peta OpenStreetMap. Gunakan tombol 'Buka Google Maps' — tempat kecil seperti kafe/warung biasanya hanya ada di Google Maps."
        );
      }
    } catch (e: any) {
      setError(e?.message || "Gagal mencari lokasi");
    } finally {
      setSearching(false);
    }
  };

  const openGoogleMaps = () => {
    const q = encodeURIComponent(query.trim() || "lokasi");
    window.open(`https://www.google.com/maps/search/${q}`, "_blank");
  };

  const handleMapsLink = (link: string) => {
    setMapsLink(link);
    const parsed = parseGoogleMapsLink(link.trim());
    if (parsed) onPick(parsed.lat, parsed.lng);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
          placeholder="Cari nama tempat — mis. Phi Cafe, Bandung"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          <Search className="mr-1 inline h-3.5 w-3.5" />
          {searching ? "Mencari..." : "Cari"}
        </button>
        <button
          type="button"
          onClick={openGoogleMaps}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <MapPin className="mr-1 inline h-3.5 w-3.5" />Google Maps
        </button>
      </div>

      {results.length > 0 && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-1">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onPick(parseFloat(r.lat), parseFloat(r.lon));
                setResults([]);
                setQuery("");
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-blue-50"
            >
              {r.display_name}
              <span className="block text-[10px] text-gray-400">
                {parseFloat(r.lat).toFixed(6)}, {parseFloat(r.lon).toFixed(6)}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div>
        <p className="text-[10px] text-gray-500">
          Lewat Google Maps: buka tab baru → cari tempat → <b>Share → Copy link</b> → tempel di bawah.
        </p>
        <input
          type="text"
          value={mapsLink}
          onChange={(e) => handleMapsLink(e.target.value)}
          placeholder="https://www.google.com/maps/@-6.8712,107.5903,17z ..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
