import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Modal, TextInput, ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { useAuth } from "../contexts/AuthContext";
import { getAttendanceStatus, submitAttendance } from "../lib/attendance";
import { getTodaySessions, CheckpointSession } from "../lib/checkpoint";
import { getPendingCount, onPendingChange, getPendingItems, PendingItem } from "../lib/sync";
import CheckpointScanScreen from "./CheckpointScanScreen";
import CheckpointSessionScreen from "./CheckpointSessionScreen";

type Screen = "home" | "scan" | "session";

export default function CleanerHomeScreen() {
  const { user, signOut } = useAuth();
  const [screen, setScreen] = useState<Screen>("home");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [siteName, setSiteName] = useState<string | null>(null);
  const [completedCP, setCompletedCP] = useState(0);
  const [totalCP, setTotalCP] = useState(0);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [sessions, setSessions] = useState<CheckpointSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeCheckpointName, setActiveCheckpointName] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const [status, todaySessions] = await Promise.all([
      getAttendanceStatus(),
      getTodaySessions(),
    ]);
    setCheckedIn(status.checkedIn);
    setSiteName(status.siteName);
    setCompletedCP(status.completedCheckpoints);
    setTotalCP(status.totalCheckpoints);
    setSessions(todaySessions);
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

  const handleAttendanceAction = async (type: "check_in" | "check_out", reason?: string) => {
    setActionLoading(true);
    const loc = location || (await getLocation());
    if (!loc) { setActionLoading(false); return; }

    const fakePhotoUrl = `https://via.placeholder.com/640`;

    const res = await submitAttendance(type, loc.coords.latitude, loc.coords.longitude, fakePhotoUrl, reason);

    if (res.success) {
      Alert.alert("Berhasil", res.message);
      await loadStatus();
    } else if (res.message.includes("m dari site")) {
      setShowOverride(true);
    } else {
      Alert.alert("Gagal", res.message);
    }
    setActionLoading(false);
  };

  const handleOverrideSubmit = () => {
    if (!overrideReason.trim()) {
      Alert.alert("Perhatian", "Isi alasan override terlebih dahulu.");
      return;
    }
    setShowOverride(false);
    handleAttendanceAction("check_in", overrideReason.trim());
    setOverrideReason("");
  };

  const handleSessionStarted = (sessionId: string, checkpointName: string) => {
    setActiveSessionId(sessionId);
    setActiveCheckpointName(checkpointName);
    setScreen("session");
  };

  const handleSessionComplete = async () => {
    setScreen("home");
    await loadStatus();
  };

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    getPendingCount().then(setPendingCount);
    getPendingItems().then(setPendingItems);
    const unsub = onPendingChange((count) => {
      setPendingCount(count);
      getPendingItems().then(setPendingItems);
    });
    return unsub;
  }, []);

  // --- Scan Screen ---
  if (screen === "scan") {
    return (
      <View style={{ flex: 1 }}>
        <CheckpointScanScreen onSessionStarted={handleSessionStarted} />
        <TouchableOpacity style={s.backAbsolute} onPress={() => setScreen("home")}>
          <Text style={{ color: "#6b7280", fontSize: 14 }}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Session Screen ---
  if (screen === "session" && activeSessionId) {
    return (
      <CheckpointSessionScreen
        sessionId={activeSessionId}
        checkpointName={activeCheckpointName}
        onComplete={handleSessionComplete}
        onBack={() => setScreen("home")}
      />
    );
  }

  // --- Home Screen ---
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>Halo, Cleaner!</Text>
            <Text style={s.site}>{siteName || "Belum ditugaskan"}</Text>
          </View>
          {pendingCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{pendingCount} pending</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.statusCard}>
        <View style={s.statusRow}>
          <Text style={s.statusLabel}>Status</Text>
          <Text style={[s.statusValue, checkedIn ? s.statusIn : s.statusOut]}>
            {checkedIn ? "Sudah Check-in" : "Belum Check-in"}
          </Text>
        </View>
        <View style={s.progressRow}>
          <Text style={s.statusLabel}>Checkpoint</Text>
          <Text style={s.progressValue}>{completedCP} / {totalCP} selesai</Text>
        </View>
      </View>

      {/* Check-in/out button */}
      <TouchableOpacity
        style={[s.mainBtn, checkedIn ? s.checkoutBtn : s.checkinBtn, actionLoading && s.btnDisabled]}
        onPress={() => handleAttendanceAction(checkedIn ? "check_out" : "check_in")}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.mainBtnText}>{checkedIn ? "Check-Out" : "Check-In"}</Text>
        )}
      </TouchableOpacity>

      {/* Scan checkpoint button */}
      <TouchableOpacity
        style={[s.scanBtn, !checkedIn && s.btnDisabled]}
        onPress={() => setScreen("scan")}
        disabled={!checkedIn}
      >
        <Text style={s.scanBtnText}>Scan Checkpoint</Text>
      </TouchableOpacity>

      {/* Today's sessions */}
      <View style={s.sessionsSection}>
        <Text style={s.sectionTitle}>Riwayat Hari Ini</Text>
        {sessions.length === 0 ? (
          <Text style={s.emptyText}>Belum ada sesi pembersihan hari ini.</Text>
        ) : (
          sessions.map((session) => (
            <View key={session.id} style={s.sessionCard}>
              <View style={s.sessionInfo}>
                <Text style={s.sessionName}>{session.checkpoints?.name || "Checkpoint"}</Text>
                <Text style={s.sessionTime}>
                  {new Date(session.started_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  {session.duration_minutes ? ` — ${session.duration_minutes} menit` : ""}
                </Text>
              </View>
              <Text style={[
                s.sessionStatus,
                session.status === "completed" ? s.statusCompleted :
                session.status === "in_progress" ? s.statusProgress : s.statusExpired,
              ]}>
                {session.status === "completed" ? "Selesai" :
                 session.status === "in_progress" ? "Berjalan" : "Kedaluwarsa"}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Pending sync items */}
      {pendingItems.length > 0 && (
        <View style={s.sessionsSection}>
          <Text style={s.sectionTitle}>Antrian Sinkronisasi</Text>
          {pendingItems.map((item, idx) => (
            <View key={idx} style={s.syncItem}>
              <View style={s.syncInfo}>
                <Text style={s.syncLabel}>{item.label}</Text>
                <Text style={s.syncTime}>
                  {new Date(item.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <Text style={[s.syncStatus, item.synced ? s.syncedText : s.pendingText]}>
                {item.synced ? "Tersinkron" : "Tersimpan lokal"}
              </Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.logoutBtn} onPress={signOut}>
        <Text style={s.logoutText}>Keluar</Text>
      </TouchableOpacity>

      {/* Override Modal */}
      <Modal visible={showOverride} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Di Luar Area Site</Text>
            <Text style={s.modalText}>Berikan alasan untuk melanjutkan:</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Alasan (contoh: GPS tidak akurat)"
              value={overrideReason}
              onChangeText={setOverrideReason}
              multiline
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => { setShowOverride(false); setOverrideReason(""); }}>
                <Text style={s.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={handleOverrideSubmit}>
                <Text style={s.modalConfirmText}>Lanjutkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { marginBottom: 24 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  badge: {
    backgroundColor: "#fef3c7", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { color: "#92400e", fontSize: 12, fontWeight: "600" },
  greeting: { fontSize: 22, fontWeight: "bold", color: "#111827" },
  site: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  statusCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 20, marginBottom: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
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
    borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  checkinBtn: { backgroundColor: "#16a34a" },
  checkoutBtn: { backgroundColor: "#dc2626" },
  btnDisabled: { opacity: 0.6 },
  mainBtnText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  scanBtn: {
    backgroundColor: "#2563eb", borderRadius: 12, padding: 16, alignItems: "center",
    marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  scanBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  sessionsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 },
  emptyText: { color: "#9ca3af", fontSize: 14, textAlign: "center", paddingVertical: 20 },
  sessionCard: {
    backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 8,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  sessionTime: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  sessionStatus: { fontSize: 12, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusCompleted: { color: "#16a34a", backgroundColor: "#f0fdf4" },
  statusProgress: { color: "#2563eb", backgroundColor: "#eff6ff" },
  statusExpired: { color: "#dc2626", backgroundColor: "#fef2f2" },
  logoutBtn: { padding: 14, alignItems: "center" },
  logoutText: { color: "#6b7280", fontSize: 14 },
  backAbsolute: { position: "absolute", top: 60, left: 20, zIndex: 10, padding: 8 },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  modalText: { fontSize: 14, color: "#6b7280", marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 16, minHeight: 80, textAlignVertical: "top" },
  modalBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalCancel: { padding: 10 },
  modalCancelText: { color: "#6b7280", fontSize: 14 },
  modalConfirm: { backgroundColor: "#2563eb", borderRadius: 8, padding: 10, paddingHorizontal: 20 },
  modalConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  syncItem: {
    backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 6,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  syncInfo: { flex: 1 },
  syncLabel: { fontSize: 13, fontWeight: "600", color: "#111827" },
  syncTime: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  syncStatus: { fontSize: 11, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  syncedText: { color: "#16a34a", backgroundColor: "#f0fdf4" },
  pendingText: { color: "#d97706", backgroundColor: "#fef3c7" },
});
