import { createClient } from "@/lib/supabase/server";

// Spotlight kehadiran hari ini: check-in per user dengan penanda keterlambatan
// (merah) berdasarkan sites.start_time. Waktu lokal diasumsikan WIB (UTC+7).
export default async function AttendanceSpotlight() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, start_time");

  const { data: checkIns } = await supabase
    .from("attendance_logs")
    .select("timestamp, user_id, users(name, role), sites(name)")
    .eq("type", "check_in")
    .gte("timestamp", today)
    .order("timestamp", { ascending: true });

  const { data: users } = await supabase
    .from("users")
    .select("id, name, role, site_id")
    .in("role", ["cleaner", "security"]);

  const checkInByUser: Record<string, { ts: Date; local: string }> = {};
  for (const c of checkIns || []) {
    const d = new Date(c.timestamp);
    const local = new Date(d.getTime() + 7 * 3600 * 1000);
    if (!checkInByUser[c.user_id]) {
      checkInByUser[c.user_id] = { ts: d, local: local.toISOString().slice(11, 16) };
    }
  }

  const lateBySite: Record<string, string> = {};
  for (const s of sites || []) lateBySite[s.id] = s.start_time || "08:00";

  const bySite: Record<string, { id: string; name: string; role: string; local: string | null; late: boolean }[]> = {};
  for (const u of users || []) {
    if (!u.site_id) continue;
    const entry = checkInByUser[u.id];
    const start = lateBySite[u.site_id];
    bySite[u.site_id] = bySite[u.site_id] || [];
    bySite[u.site_id].push({
      id: u.id,
      name: u.name,
      role: u.role,
      local: entry?.local ?? null,
      late: !!entry && entry.local > start,
    });
  }

  const lateCount = Object.values(bySite)
    .flat()
    .filter((u) => u.late).length;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Kehadiran Hari Ini</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${lateCount > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {lateCount} terlambat
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(bySite).map(([siteId, members]) => {
          const site = (sites || []).find((s) => s.id === siteId);
          const belum = members.filter((m) => !m.local);
          return (
            <div key={siteId}>
              <p className="mb-2 text-xs font-medium text-gray-500">
                {site?.name ?? "-"} · mulai {site?.start_time || "08:00"} WIB
              </p>
              <div className="space-y-1">
                {members
                  .sort((a, b) => (a.local ?? "99:99").localeCompare(b.local ?? "99:99"))
                  .map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                      <span className="text-gray-700">
                        {m.name}{" "}
                        <span className="text-xs text-gray-400">
                          {m.role === "security" ? "· Security" : ""}
                        </span>
                      </span>
                      {m.local ? (
                        <span className="flex items-center gap-2">
                          <span className={m.late ? "font-semibold text-red-600" : "text-gray-600"}>{m.local}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.late ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {m.late ? "Terlambat" : "Tepat"}
                          </span>
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">Belum</span>
                      )}
                    </div>
                  ))}
              </div>
              {belum.length === 0 && null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Terlambat = check-in setelah jam mulai site (WIB). Data lengkap di menu Log.
      </p>
    </div>
  );
}
