import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput,
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";

// Tambah checkpoint untuk site supervisor (dibatasi RLS ke site sendiri).
// Koordinat diambil dari GPS — supervisor berdiri di lokasi fisik checkpoint.
export default function AddCheckpointScreen({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nextOrder, setNextOrder] = useState(1);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: dbUser } = await supabase
        .from("users")
        .select("site_id")
        .eq("auth_id", user.id)
        .single();
      if (!dbUser?.site_id) return;
      const { data: last } = await supabase
        .from("checkpoints")
        .select("display_order")
        .eq("site_id", dbUser.site_id)
        .order("display_order", { ascending: false })
        .limit(1);
      setNextOrder((last?.[0]?.display_order ?? 0) + 1);
    })();
  }, []);

  const takeLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Izin GPS", "Aktifkan izin lokasi untuk mengambil posisi checkpoint.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Gagal mengambil posisi");
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Perhatian", "Isi nama checkpoint dulu."); return; }
    if (!location) { Alert.alert("Perhatian", "Ambil posisi GPS dulu — berdiri di lokasi checkpoint."); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert("Gagal", "Sesi tidak ditemukan. Login ulang."); return; }
      const { data: dbUser } = await supabase
        .from("users")
        .select("site_id")
        .eq("auth_id", user.id)
        .single();
      if (!dbUser?.site_id) { Alert.alert("Gagal", "Anda belum ditugaskan ke site manapun."); return; }

      const { error } = await supabase.from("checkpoints").insert({
        site_id: dbUser.site_id,
        name: name.trim(),
        latitude: location.lat,
        longitude: location.lng,
        display_order: nextOrder,
      });
      if (error) { Alert.alert("Gagal", error.message); return; }

      Alert.alert("Berhasil", `Checkpoint "${name.trim()}" ditambahkan (urutan ${nextOrder}).`, [
        { text: "OK", onPress: onDone },
      ]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tambah Checkpoint</Text>
        <TouchableOpacity onPress={onDone}><Text style={styles.cancel}>Tutup</Text></TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Checkpoint ditambahkan ke site yang ditugaskan kepada Anda. Koordinat diambil dari GPS
        saat Anda berada di lokasi fisik checkpoint.
      </Text>

      <Text style={styles.label}>Nama Checkpoint</Text>
      <TextInput
        style={styles.input}
        placeholder="mis. Dapur"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Posisi (Latitude, Longitude)</Text>
      <View style={styles.locBox}>
        {location ? (
          <Text style={styles.locText}>
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </Text>
        ) : (
          <Text style={styles.locEmpty}>Belum ada posisi — ambil sambil berdiri di lokasi</Text>
        )}
      </View>
      <TouchableOpacity style={styles.locBtn} onPress={takeLocation} disabled={locating}>
        {locating ? <ActivityIndicator color="#fff" /> : <Text style={styles.locBtnText}>Ambil Posisi Ini</Text>}
      </TouchableOpacity>

      <Text style={styles.orderText}>Urutan tampilan: {nextOrder} (otomatis)</Text>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Simpan Checkpoint</Text>}
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
  label: { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: "#fff" },
  locBox: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, backgroundColor: "#fff", marginBottom: 10 },
  locText: { fontSize: 14, color: "#111827", fontWeight: "600" },
  locEmpty: { fontSize: 13, color: "#9ca3af" },
  locBtn: { backgroundColor: "#059669", borderRadius: 10, padding: 14, alignItems: "center" },
  locBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  orderText: { fontSize: 12, color: "#6b7280", marginTop: 12 },
  saveBtn: { backgroundColor: "#2563eb", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 24 },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
