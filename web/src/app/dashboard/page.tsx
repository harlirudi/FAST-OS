import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  if (role === "admin") {
    redirect("/admin/dashboard");
  }

  // Non-admin di web: arahkan ke info seluler (dashboard utama ada di mobile app)
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-bold">Selamat datang, {name}</h1>
        <p className="mt-2 text-sm text-gray-600">
          Peran: {role === "cleaner" ? "Cleaner" : role === "supervisor" ? "Supervisor" : role}
        </p>
        <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-medium">Gunakan aplikasi mobile untuk aktivitas lapangan</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-blue-700">
            <li>Check-in / check-out dengan GPS & selfie</li>
            <li>Scan checkpoint (NFC / QR)</li>
            <li>Lihat riwayat & progres harian</li>
          </ul>
        </div>
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
