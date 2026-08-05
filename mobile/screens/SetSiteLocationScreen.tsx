import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, FlatList,
} from "react-native";
import * as Location from "expo-location";
import { updateSiteLocation, getAllSites, SiteOption } from "../lib/supervisor";

export default function SetSiteLocationScreen({ onDone }: { onDone: () => void }) {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSite, setSelectedSite] = useState<SiteOption | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    (async () => {
      const allSites = await getAllSites();
      setSites(allSites);
      setLoading(false);
    })();
  }, []);

  const handleSetLocation = async () => {
    if (!selectedSite) {
      Alert.alert("Pilih Site", "Pilih site dulu sebelum set lokasi.");
      return;
    }
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Izin GPS", "Aktifkan GPS untuk set lokasi site.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const res = await updateSiteLocation(selectedSite.id, loc.coords.latitude, loc.coords.longitude);
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

      <Text style={styles.label}>Pilih Site</Text>
      <TouchableOpacity style={styles.picker} onPress={() => setShowPicker(true)}>
        <Text style={selectedSite ? styles.pickerText : styles.pickerPlaceholder}>
          {selectedSite ? selectedSite.name : "Pilih site..."}
        </Text>
        <Text style={styles.pickerArrow}>▾</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        {"Berdirilah di titik yang dianggap pusat site (misal depan gedung), lalu tekan tombol di bawah. Koordinat GPS saat ini akan menjadi acuan geofencing check-in/out cleaner."}
      </Text>

      <TouchableOpacity
        style={[styles.setBtn, locating && styles.btnDisabled]}
        onPress={handleSetLocation}
        disabled={locating}
      >
        {locating ? <ActivityIndicator color="#fff" /> : <Text style={styles.setBtnText}>Set Lokasi Saat Ini</Text>}
      </TouchableOpacity>

      <Text style={styles.note}>
        Radius geofencing: 50m (ubah di web admin → Site)
      </Text>

      <Modal visible={showPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Site</Text>
            <FlatList
              data={sites}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.siteRow, selectedSite?.id === item.id && styles.siteRowSelected]}
                  onPress={() => { setSelectedSite(item); setShowPicker(false); }}
                >
                  <Text style={styles.siteRowText}>{item.name}</Text>
                  {selectedSite?.id === item.id && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowPicker(false)}>
              <Text style={styles.modalCloseText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6", padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  cancel: { color: "#6b7280", fontSize: 14 },
  label: { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  picker: {
    backgroundColor: "#fff", borderRadius: 10, padding: 16, marginBottom: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#d1d5db",
  },
  pickerText: { fontSize: 15, color: "#111827", fontWeight: "600" },
  pickerPlaceholder: { fontSize: 15, color: "#9ca3af" },
  pickerArrow: { fontSize: 16, color: "#6b7280" },
  hint: { fontSize: 14, color: "#374151", lineHeight: 22, backgroundColor: "#eff6ff", borderRadius: 10, padding: 16, marginBottom: 24 },
  setBtn: { backgroundColor: "#2563eb", borderRadius: 12, padding: 18, alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  setBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  note: { fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 16 },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 20, width: "100%", maxHeight: "70%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  siteRow: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  siteRowSelected: { backgroundColor: "#eff6ff" },
  siteRowText: { fontSize: 15, color: "#111827" },
  checkMark: { fontSize: 16, color: "#2563eb", fontWeight: "bold" },
  modalClose: { marginTop: 12, alignItems: "center", padding: 10 },
  modalCloseText: { color: "#6b7280", fontSize: 14 },
});
