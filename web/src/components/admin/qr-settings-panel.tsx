"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";

export function QrSettingsPanel() {
  const [minutes, setMinutes] = useState("5");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const supabase = useMemo(() => createClient(), []);

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
    setStatus(null);
    const val = parseInt(minutes, 10);
    if (!val || val < 1 || val > 60) {
      setStatus({ type: "error", text: "Masukkan angka antara 1 sampai 60 menit." });
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("app_config")
      .upsert({ key: "qr_validity_minutes", value: String(val), updated_at: new Date().toISOString() });
    if (error) {
      setStatus({ type: "error", text: `Gagal menyimpan: ${error.message}` });
    } else {
      setStatus({ type: "success", text: "Pengaturan berhasil disimpan." });
    }
    setSaving(false);
  };

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          <CardTitle className="text-lg font-bold text-slate-800">Pengaturan QR Dinamis</CardTitle>
        </div>
        <CardDescription className="text-xs text-slate-500">
          Atur masa berlaku kode QR dinamis pada aplikasi supervisor
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48 space-y-1">
            <Label className="text-xs text-slate-600">Durasi Berlaku (menit)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              className="h-9"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <Button size="sm" className="h-9 px-4" onClick={save} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Durasi"}
          </Button>
          {status && (
            <div
              className={`flex items-center gap-1.5 text-xs font-medium ${
                status.type === "success" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              <span>{status.text}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
