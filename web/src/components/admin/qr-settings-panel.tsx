"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function QrSettingsPanel() {
  const [minutes, setMinutes] = useState("5");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("app_config")
      .select("value")
      .eq("key", "qr_validity_minutes")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setMinutes(data.value);
      });
  }, [supabase]);

  const save = async () => {
    setSaving(true);
    setMessage("");
    const val = parseInt(minutes, 10);
    if (!val || val < 1 || val > 60) {
      setMessage("Masukkan angka 1-60 menit");
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("app_config")
      .upsert({ key: "qr_validity_minutes", value: String(val), updated_at: new Date().toISOString() });
    if (error) {
      setMessage(`Gagal: ${error.message}`);
    } else {
      setMessage("Tersimpan. Berlaku untuk semua checkpoint.");
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Pengaturan QR Dinamis</CardTitle></CardHeader>
      <CardContent className="flex items-end gap-4">
        <div className="w-40">
          <Label>Durasi berlaku (menit)</Label>
          <Input type="number" min={1} max={60} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
        {message && <p className="text-sm text-gray-500">{message}</p>}
      </CardContent>
    </Card>
  );
}
