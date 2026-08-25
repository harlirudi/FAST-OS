"use server";

// Google Geocoding API — dipanggil server-side agar API key tidak bocor ke browser.
// Env: GOOGLE_GEOCODING_API_KEY (set di Vercel project settings / .env.local)

const GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export async function geocodePlace(
  query: string
): Promise<{ lat: number; lng: number; display_name: string }[]> {
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) {
    throw new Error("Geocoding belum dikonfigurasi (GOOGLE_GEOCODING_API_KEY).");
  }

  const url = `${GEOCODING_URL}?address=${encodeURIComponent(query)}&key=${key}&language=id&region=id`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error("Gagal terhubung ke Google Geocoding");

  const data = await res.json();
  if (data.status === "ZERO_RESULTS") return [];
  if (data.status !== "OK") {
    throw new Error(`Google Geocoding: ${data.status} — ${data.error_message ?? ""}`);
  }

  return (data.results as any[]).map((r) => ({
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    display_name: r.formatted_address,
  }));
}
