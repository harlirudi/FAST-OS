import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { getCheckpointsForPairing, PairingCheckpoint } from "../lib/supervisor";
import { supabase } from "../lib/supabase";

const DEFAULT_VALIDITY_MINUTES = 5; // fallback jika config tidak ada

function buildToken(checkpointId: string): string {
  return `dy_${checkpointId}_${Math.floor(Date.now() / 1000)}`;
}

export default function QrBackupScreen({ onDone }: { onDone: () => void }) {
  const [checkpoints, setCheckpoints] = useState<PairingCheckpoint[]>([]);
  const [selected, setSelected] = useState<PairingCheckpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_VALIDITY_MINUTES * 60);
  const [validityMinutes, setValidityMinutes] = useState(DEFAULT_VALIDITY_MINUTES);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: dbUser } = await supabase.from("users").select("site_id").eq("auth_id", user.id).single();
      if (dbUser?.site_id) {
        const cps = await getCheckpointsForPairing(dbUser.site_id);
        setCheckpoints(cps);
      }
      // Baca durasi berlaku dari config
      const { data: cfg } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "qr_validity_minutes")
        .maybeSingle();
      const minutes = parseInt(cfg?.value || String(DEFAULT_VALIDITY_MINUTES), 10) || DEFAULT_VALIDITY_MINUTES;
      setValidityMinutes(minutes);
      setLoading(false);
    })();
  }, []);

  // Saat checkpoint dipilih: buat token + mulai countdown + auto-refresh
  useEffect(() => {
    if (!selected?.id) return;
    const totalSec = validityMinutes * 60;
    setToken(buildToken(selected.id));
    setSecondsLeft(totalSec);

    const countdown = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // Expire: generate token baru
          setToken(buildToken(selected.id));
          return totalSec;
        }
        return s - 1;
      });
    }, 1000);

    const autoRefresh = setInterval(() => {
      setToken(buildToken(selected.id));
      setSecondsLeft(totalSec);
    }, (totalSec - 60) * 1000); // refresh 1 menit sebelum expire

    return () => { clearInterval(countdown); clearInterval(autoRefresh); };
  }, [selected?.id, validityMinutes]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  if (selected) {
    const expired = secondsLeft <= 0;
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Text style={styles.back}>← Daftar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDone}><Text style={styles.cancel}>Tutup</Text></TouchableOpacity>
        </View>
        <Text style={styles.title}>{selected.name}</Text>
        <Text style={styles.sub}>QR dinamis — berlaku {validityMinutes} menit, anti screenshot</Text>
        <View style={styles.qrBox}>
          <QRCode value={token} size={260} />
        </View>
        <View style={[styles.timer, expired && styles.timerExpired]}>
          <Text style={styles.timerText}>
            {expired ? "Kedaluwarsa — menunggu QR baru..." : `Berlaku ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setToken(buildToken(selected.id)); setSecondsLeft(validityMinutes * 60); }}>
          <Text style={styles.refreshText}>Refresh QR Sekarang</Text>
        </TouchableOpacity>
        <Text style={styles.tip}>Naikkan kecerahan layar agar mudah di-scan</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>QR Backup</Text>
        <TouchableOpacity onPress={onDone}><Text style={styles.cancel}>Tutup</Text></TouchableOpacity>
      </View>
      <Text style={styles.hint}>Pilih checkpoint untuk menampilkan QR dinamis (berlaku {validityMinutes} menit)</Text>
      <ScrollView style={{ flex: 1 }}>
        {checkpoints.map((cp) => (
          <TouchableOpacity key={cp.id} style={styles.card} onPress={() => setSelected(cp)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{cp.name}</Text>
              <Text style={styles.cardSub}>QR dinamis — anti screenshot</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6", padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  back: { color: "#2563eb", fontSize: 14, fontWeight: "600" },
  cancel: { color: "#6b7280", fontSize: 14 },
  hint: { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  cardName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  cardSub: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  arrow: { fontSize: 20, color: "#9ca3af" },
  sub: { fontSize: 13, color: "#6b7280", marginTop: 4, textAlign: "center" },
  qrBox: { backgroundColor: "#fff", borderRadius: 16, padding: 24, alignItems: "center", marginTop: 24, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  timer: { backgroundColor: "#d1fae5", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, marginTop: 16, alignSelf: "center" },
  timerExpired: { backgroundColor: "#fee2e2" },
  timerText: { fontSize: 14, fontWeight: "600", color: "#065f46" },
  refreshBtn: { marginTop: 16, alignSelf: "center", padding: 10 },
  refreshText: { color: "#2563eb", fontSize: 14, fontWeight: "600" },
  tip: { fontSize: 12, color: "#6b7280", textAlign: "center", marginTop: 16 },
});
