import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, FlatList,
} from "react-native";
import * as Location from "expo-location";
import { pairNfcTagToCheckpoint, getCheckpointsForPairing, PairingCheckpoint } from "../lib/supervisor";
import { isNfcSupported, isNfcEnabled, readNfcTag, startNfcSession, stopNfcSession } from "../lib/nfc";
import { supabase } from "../lib/supabase";

export default function NfcPairingScreen({ onDone }: { onDone: () => void }) {
  const [checkpoints, setCheckpoints] = useState<PairingCheckpoint[]>([]);
  const [selected, setSelected] = useState<PairingCheckpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [nfcReady, setNfcReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: dbUser } = await supabase.from("users").select("site_id").eq("auth_id", user.id).single();
      if (dbUser?.site_id) {
        const cps = await getCheckpointsForPairing(dbUser.site_id);
        setCheckpoints(cps);
      }
      const supported = await isNfcSupported().catch(() => false);
      if (!supported) { setLoading(false); Alert.alert("NFC", "Perangkat tidak mendukung NFC"); return; }
      const enabled = await isNfcEnabled().catch(() => false);
      if (!enabled) { setLoading(false); Alert.alert("NFC Mati", "Aktifkan NFC di Settings."); return; }
      await startNfcSession().catch(() => {});
      setNfcReady(true);
      setLoading(false);
    })();
    return () => { stopNfcSession().catch(() => {}); };
  }, []);

  const handleTap = async () => {
    if (!selected) { Alert.alert("Pilih checkpoint dulu"); return; }
    if (!nfcReady || listening) return;
    setListening(true);
    try {
      const result = await readNfcTag();
      if (!result.success || !result.tagId) {
        Alert.alert("NFC", result.error || "Gagal membaca");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const res = await pairNfcTagToCheckpoint(selected.id, result.tagId, loc.coords.latitude, loc.coords.longitude);
      if (res.success) {
        Alert.alert("Berhasil", `${selected.name} terpasang dengan ${result.tagId}`);
        setSelected(null);
        onDone();
      } else {
        Alert.alert("Gagal", res.message);
      }
    } finally {
      setListening(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pasang NFC Tag</Text>
        <TouchableOpacity onPress={onDone}><Text style={styles.cancel}>Tutup</Text></TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        {selected
          ? `Checkpoint: ${selected.name}\nTempelkan NFC tag ke belakang HP. Koordinat saat ini akan disimpan.`
          : "Pilih checkpoint yang mau dipasangi tag NFC"}
      </Text>

      <ScrollView style={{ flex: 1 }}>
        {checkpoints.map((cp) => (
          <TouchableOpacity
            key={cp.id}
            style={[styles.card, selected?.id === cp.id && styles.cardSelected]}
            onPress={() => setSelected(cp)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{cp.name}</Text>
              <Text style={styles.cardSub}>
                {cp.nfc_tag_id ? `Terpasang: ${cp.nfc_tag_id}` : "Belum ada tag"}
              </Text>
            </View>
            {selected?.id === cp.id && <Text style={styles.checkMark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.pairBtn, (!selected || !nfcReady || listening) && styles.btnDisabled]}
        onPress={handleTap}
        disabled={!selected || !nfcReady || listening}
      >
        <Text style={styles.pairBtnText}>
          {listening ? "Menunggu tag..." : selected ? "Tap NFC Tag" : "Pilih Checkpoint"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6", padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  cancel: { color: "#6b7280", fontSize: 14 },
  hint: { fontSize: 13, color: "#374151", backgroundColor: "#eff6ff", borderRadius: 8, padding: 12, marginBottom: 16, lineHeight: 20 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  cardSelected: { borderWidth: 2, borderColor: "#2563eb" },
  cardName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  cardSub: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  checkMark: { fontSize: 18, color: "#2563eb", fontWeight: "bold" },
  pairBtn: { backgroundColor: "#2563eb", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 12 },
  btnDisabled: { opacity: 0.5 },
  pairBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
