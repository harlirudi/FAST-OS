import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import * as Location from "expo-location";
import { updateSiteLocation } from "../lib/supervisor";
import { supabase } from "../lib/supabase";

export default function SetSiteLocationScreen({ onDone }: { onDone: () => void }) {
  const [siteName, setSiteName] = useState("");
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: dbUser } = await supabase.from("users").select("site_id").eq("auth_id", user.id).single();
      if (dbUser?.site_id) {
        const { data: site } = await supabase.from("sites").select("name").eq("id", dbUser.site_id).single();
        setSiteName(site?.name || "");
      }
      setLoading(false);
    })();
  }, []);

  const handleSetLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Izin GPS", "Aktifkan GPS untuk set lokasi site.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const res = await updateSiteLocation(loc.coords.latitude, loc.coords.longitude);
      if (res.success) {
        Alert.alert(
          "Berhasil",
          `${res.message}\n\nLatitude: ${loc.coords.latitude.toFixed(6)}\nLongitude: ${loc.coords.longitude.toFixed(6)}`,
          [{ text: "OK", onPress: onDone }]
        );
      } else {
        Alert.alert("Gagal", res.message);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Terjadi kesalahan");
    } finally {
      setLocating(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Set Lokasi Site</Text>
        <TouchableOpacity onPress={onDone}><Text style={styles.cancel}>Tutup</Text></TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Site: <Text style={{ fontWeight: "600" }}>{siteName || "?"}</Text>
        {"\n\n"}Berdirilah di titik yang dianggap pusat site (misal depan gedung), lalu tekan tombol di bawah. Koordinat GPS saat ini akan menjadi acuan geofencing check-in/out cleaner.
      </Text>

      <TouchableOpacity
        style={[styles.setBtn, locating && styles.btnDisabled]}
        onPress={handleSetLocation}
        disabled={locating}
      >
        {locating ? <ActivityIndicator color="#fff" /> : <Text style={styles.setBtnText}>Set Lokasi Saat Ini</Text>}
      </TouchableOpacity>

      <Text style={styles.note}>
        Radius geofencing saat ini: 50m (bisa diubah di web admin → Site)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6", padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  cancel: { color: "#6b7280", fontSize: 14 },
  hint: { fontSize: 14, color: "#374151", lineHeight: 22, backgroundColor: "#eff6ff", borderRadius: 10, padding: 16, marginBottom: 24 },
  setBtn: { backgroundColor: "#2563eb", borderRadius: 12, padding: 18, alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  setBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  note: { fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 16 },
});
