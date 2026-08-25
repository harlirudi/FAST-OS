import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AutoRefresh from "@/components/dashboard/auto-refresh";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("name, role, site_id")
    .eq("auth_id", user.id)
    .single();

  const role = dbUser?.role ?? "unknown";
  const name = dbUser?.name || user.user_metadata?.full_name || user.email;
  const hasSite = !!dbUser?.site_id;

  if (role === "admin") {
    redirect("/admin/dashboard");
  }

  // Non-admin di web: arahkan ke info seluler (dashboard utama ada di mobile app)
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-bold">Selamat datang, {name}</h1>
        <p className="mt-2 text-sm text-gray-600">
          Peran: {role === "cleaner" ? "Cleaner" : role === "security" ? "Security" : role === "supervisor" ? "Supervisor" : role}
        </p>

        {!hasSite ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-3xl font-bold text-amber-700">Menunggu Penugasan</p>
            <p className="mt-3 text-sm text-amber-800">
              Akun kamu sudah terdaftar, tapi belum ditugaskan ke site manapun.
            </p>
            <p className="mt-2 text-sm text-amber-700">
              Hubungi supervisor atau admin untuk penugasan. Setelah ditugaskan,
              kamu bisa langsung menggunakan aplikasi mobile.
            </p>
            <p className="mt-4 text-xs text-amber-600">
              Halaman ini diperbarui otomatis setiap 30 detik.
            </p>
            <AutoRefresh />
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-medium">Gunakan aplikasi mobile untuk aktivitas lapangan</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-blue-700">
              <li>Check-in / check-out dengan GPS & selfie</li>
              <li>Scan checkpoint (NFC / QR)</li>
              <li>Lihat riwayat & progres harian</li>
            </ul>
          </div>
        )}
        <form action="/auth/signout" method="post" className="mt-4">
          <button
            type="submit"
            className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            Keluar
          </button>
        </form>
      </div>
    </div>
  );
}
