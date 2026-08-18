"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUserEmail(user.email || "");
      setName(user.user_metadata?.full_name || user.user_metadata?.name || "");
      setLoading(false);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // Cek apakah record sudah ada (dibuat trigger handle_new_user)
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    let error;
    if (existing) {
      // Update tanpa menyentuh role (jaga role yang sudah dipromosikan admin)
      ({ error } = await supabase
        .from("users")
        .update({
          name: name.trim(),
          phone: phone.trim(),
        })
        .eq("auth_id", user.id));
    } else {
      // Record belum ada — buat baru dengan role default cleaner
      ({ error } = await supabase.from("users").insert({
        auth_id: user.id,
        name: name.trim(),
        phone: phone.trim(),
        role: "cleaner",
      }));
    }

    if (error) {
      setMessage(`Gagal menyimpan: ${error.message}`);
      setSaving(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow">
        <div>
          <h1 className="text-center text-2xl font-bold text-gray-900">Lengkapi Data Diri</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Satu langkah lagi sebelum mulai menggunakan FacilityOS
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email (Google)</label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Nama lengkap kamu"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nomor HP (WhatsApp)</label>
            <div className="mt-1 flex">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                +62
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                className="block w-full rounded-r-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="81234567890"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Dipakai admin/supervisor untuk menghubungi kamu.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan & Lanjutkan"}
          </button>
        </form>

        {message && <p className="text-center text-sm text-red-600">{message}</p>}
      </div>
    </div>
  );
}
