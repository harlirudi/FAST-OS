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
    .select("role")
    .eq("auth_id", user.id)
    .single();

  const role = dbUser?.role ?? "unknown";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Selamat datang, {user.email || user.phone}
        </p>
        <p className="text-sm text-gray-500">Peran: {role}</p>
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
