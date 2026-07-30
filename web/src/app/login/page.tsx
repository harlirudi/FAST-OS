"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      router.push("/dashboard");
    }
    setLoading(false);
  };

  const handlePhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      phone: `+62${phone}`,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Kode OTP telah dikirim ke nomor Anda. Cek SMS.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow">
        <div>
          <h1 className="text-center text-2xl font-bold text-gray-900">
            FacilityOS
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Masuk ke sistem manajemen fasilitas
          </p>
        </div>

        {/* Email Login (Supervisor & Admin) */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="border-b pb-4">
            <p className="text-sm font-medium text-gray-500">
              Supervisor / Admin
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="nama@perusahaan.id"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Kata Sandi
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        {/* Phone OTP (Cleaner) */}
        <form onSubmit={handlePhoneOTP} className="space-y-4">
          <div className="border-b pb-4">
            <p className="text-sm font-medium text-gray-500">Cleaner</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nomor HP
            </label>
            <div className="mt-1 flex">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                +62
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="block w-full rounded-r-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="81234567890"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Mengirim..." : "Kirim Kode OTP"}
          </button>
        </form>

        {message && (
          <p className="text-center text-sm text-red-600">{message}</p>
        )}
      </div>
    </div>
  );
}
