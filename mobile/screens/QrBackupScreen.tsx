import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { getCheckpointsForPairing, PairingCheckpoint } from "../lib/supervisor";
import { supabase } from "../lib/supabase";

export default function QrBackupScreen({ onDone }: { onDone: () => void }) {
  const [checkpoints, setCheckpoints] = useState<PairingCheckpoint[]>([]);
  const [selected, setSelected] = useState<PairingCheckpoint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: dbUser } = await supabase.from("users").select("site_id").eq("auth_id", user.id).single();
      if (dbUser?.site_id) {
        const cps = await getCheckpointsForPairing(dbUser.site_id);
        setCheckpoints(cps);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  if (selected) {
    const qrValue = selected.qr_code_hash || `qr_${Date.now()}`;
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Text style={styles.back}>← Daftar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDone}><Text style={styles.cancel}>Tutup</Text></TouchableOpacity>
        </View>
        <Text style={styles.title}>{selected.name}</Text>
        <Text style={styles.sub}>Cleaner bisa scan QR ini sebagai fallback</Text>
        <View style={styles.qrBox}>
          {selected.qr_code_hash ? (
            <QRCode value={qrValue} size={260} />
          ) : (
            <Text style={styles.noQr}>Checkpoint ini belum punya QR hash</Text>
          )}
        </View>
        {selected.qr_code_hash && (
          <Text style={styles.hash}>Hash: {selected.qr_code_hash}</Text>
        )}
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
      <Text style={styles.hint}>Pilih checkpoint untuk menampilkan QR-nya</Text>
      <ScrollView style={{ flex: 1 }}>
        {checkpoints.map((cp) => (
          <TouchableOpacity key={cp.id} style={styles.card} onPress={() => {
            if (!cp.qr_code_hash) { Alert.alert("Belum Ada QR", "Checkpoint ini belum punya QR hash. Pasang NFC tag dulu."); return; }
            setSelected(cp);
          }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{cp.name}</Text>
              <Text style={styles.cardSub}>
                {cp.qr_code_hash ? `QR: ${cp.qr_code_hash}` : "Belum ada QR hash"}
              </Text>
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
  noQr: { color: "#9ca3af", padding: 40 },
  hash: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 12 },
  tip: { fontSize: 12, color: "#6b7280", textAlign: "center", marginTop: 16 },
});
