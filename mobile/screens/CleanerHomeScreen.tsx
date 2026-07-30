import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Modal, TextInput, ScrollView,
} from "react-native";
import * as Location from "expo-location";
import * as ImageManipulator from "expo-image-manipulator";
import { useAuth } from "../contexts/AuthContext";
import { getAttendanceStatus, submitAttendance, uploadPhoto } from "../lib/attendance";
import { supabase } from "../lib/supabase";

export default function CleanerHomeScreen() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [siteName, setSiteName] = useState<string | null>(null);
  const [completedCP, setCompletedCP] = useState(0);
  const [totalCP, setTotalCP] = useState(0);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingAction, setPendingAction] = useState<"check_in" | "check_out" | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const status = await getAttendanceStatus();
    setCheckedIn(status.checkedIn);
    setSiteName(status.siteName);
    setCompletedCP(status.completedCheckpoints);
    setTotalCP(status.totalCheckpoints);
    setLoading(false);
  }, []);

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Izin GPS", "Aktifkan GPS untuk absensi.");
      return null;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setLocation(loc);
    return loc;
  };

  const handleAttendance = async (type: "check_in" | "check_out") => {
    setActionLoading(true);
    const loc = await getLocation();
    if (!loc) { setActionLoading(false); return; }

    try {
      const res = await submitAttendance(
        type,
        loc.coords.latitude,
        loc.coords.longitude,
        "", // foto URL akan diisi nanti
      );

      if (!res.success && res.message.includes("m dari site")) {
        setPendingAction(type);
        setShowOverride(true);
        setActionLoading(false);
        return;
      }

      if (!res.success) {
        Alert.alert("Gagal", res.message);
        setActionLoading(false);
        return;
      }

      Alert.alert("Berhasil", res.message);
      await loadStatus();
    } catch (e) {
      Alert.alert("Error", "Terjadi kesalahan.");
    }
    setActionLoading(false);
  };

  const handleActionWithPhoto = async (type: "check_in" | "check_out", reason?: string) => {
    setActionLoading(true);

    const loc = location || (await getLocation());
    if (!loc) { setActionLoading(false); return; }

    const userId = user?.id;
    if (!userId) { setActionLoading(false); return; }

    try {
      // Gunakan placeholder photo untuk MVP (kamera belum terpasang di emulator)
      // Di production: ambil foto via expo-camera, compress, upload
      const fakePhotoUrl = `https://via.placeholder.com/640`;

      const res = await submitAttendance(
        type,
        loc.coords.latitude,
        loc.coords.longitude,
        fakePhotoUrl,
        reason
      );

      if (res.success) {
        Alert.alert("Berhasil", res.message);
        await loadStatus();
      } else {
        Alert.alert("Gagal", res.message);
      }
    } catch {
      Alert.alert("Error", "Terjadi kesalahan.");
    }
    setActionLoading(false);
    setShowOverride(false);
    setOverrideReason("");
    setPendingAction(null);
  };

  const handleOverrideSubmit = () => {
    if (!pendingAction || !overrideReason.trim()) {
      Alert.alert("Perhatian", "Isi alasan override terlebih dahulu.");
      return;
    }
    handleActionWithPhoto(pendingAction, overrideReason.trim());
  };

  useEffect(() => { loadStatus(); }, [loadStatus]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Halo, Cleaner!</Text>
        <Text style={styles.site}>{siteName || "Belum ditugaskan"}</Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={[styles.statusValue, checkedIn ? styles.statusIn : styles.statusOut]}>
            {checkedIn ? "Sudah Check-in" : "Belum Check-in"}
          </Text>
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.statusLabel}>Checkpoint</Text>
          <Text style={styles.progressValue}>
            {completedCP} / {totalCP} selesai
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.mainBtn,
          checkedIn ? styles.checkoutBtn : styles.checkinBtn,
          actionLoading && styles.btnDisabled,
        ]}
        onPress={() => handleActionWithPhoto(checkedIn ? "check_out" : "check_in")}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.mainBtnText}>
            {checkedIn ? "Check-Out" : "Check-In"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
        <Text style={styles.logoutText}>Keluar</Text>
      </TouchableOpacity>

      {/* Override Modal */}
      <Modal visible={showOverride} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Di Luar Area Site</Text>
            <Text style={styles.modalText}>
              Anda berada di luar radius site. Berikan alasan untuk melanjutkan:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Alasan (contoh: GPS tidak akurat)"
              value={overrideReason}
              onChangeText={setOverrideReason}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setShowOverride(false); setOverrideReason(""); }}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleOverrideSubmit}>
                <Text style={styles.modalConfirmText}>Lanjutkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: "bold", color: "#111827" },
  site: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  statusCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 20,
    marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  statusRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  statusLabel: { fontSize: 14, color: "#6b7280" },
  statusValue: { fontSize: 14, fontWeight: "600" },
  statusIn: { color: "#16a34a" },
  statusOut: { color: "#dc2626" },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressValue: { fontSize: 14, fontWeight: "600", color: "#2563eb" },
  mainBtn: {
    borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  checkinBtn: { backgroundColor: "#16a34a" },
  checkoutBtn: { backgroundColor: "#dc2626" },
  btnDisabled: { opacity: 0.6 },
  mainBtnText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  logoutBtn: { padding: 14, alignItems: "center" },
  logoutText: { color: "#6b7280", fontSize: 14 },
  modalOverlay: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)", padding: 24,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  modalText: { fontSize: 14, color: "#6b7280", marginBottom: 12 },
  modalInput: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    padding: 12, fontSize: 14, marginBottom: 16, minHeight: 80, textAlignVertical: "top",
  },
  modalBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalCancel: { padding: 10 },
  modalCancelText: { color: "#6b7280", fontSize: 14 },
  modalConfirm: { backgroundColor: "#2563eb", borderRadius: 8, padding: 10, paddingHorizontal: 20 },
  modalConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
