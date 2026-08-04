import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, FlatList, TextInput, Modal, Image,
} from "react-native";
import * as Location from "expo-location";
import { useAuth } from "../contexts/AuthContext";
import {
  getTeamStatus, getOverrides, getLastCleaningPerCheckpoint,
  getMyInspections, startInspection, TeamMember, OverrideEvent, CheckpointInspection,
} from "../lib/supervisor";
import { supabase } from "../lib/supabase";
import CheckpointScanScreen from "./CheckpointScanScreen";
import NfcPairingScreen from "./NfcPairingScreen";
import QrBackupScreen from "./QrBackupScreen";

type Tab = "team" | "inspections" | "overrides" | "photos";

export default function SupervisorDashboardScreen() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("team");
  const [loading, setLoading] = useState(true);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [overrides, setOverrides] = useState<OverrideEvent[]>([]);
  const [lastPhotos, setLastPhotos] = useState<CheckpointInspection[]>([]);
  const [inspections, setInspections] = useState<CheckpointInspection[]>([]);
  const [scanMode, setScanMode] = useState(false);
  const [pairingMode, setPairingMode] = useState(false);
  const [qrBackupMode, setQrBackupMode] = useState(false);
  const [inspectNote, setInspectNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [pendingScan, setPendingScan] = useState<{ id: string; mode: "nfc" | "qr" } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: dbUser } = await supabase
      .from("users").select("id, site_id").eq("auth_id", user!.id).single();

    if (!dbUser?.site_id) { setLoading(false); return; }
    setSiteId(dbUser.site_id);

    const [teamData, overridesData, photosData, inspectionsData] = await Promise.all([
      getTeamStatus(dbUser.site_id),
      getOverrides(dbUser.site_id),
      getLastCleaningPerCheckpoint(dbUser.site_id),
      getMyInspections(),
    ]);
    setTeam(teamData);
    setOverrides(overridesData);
    setLastPhotos(photosData);
    setInspections(inspectionsData);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleInspection = async (note?: string) => {
    if (!pendingScan) return;

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const res = await startInspection(pendingScan.id, pendingScan.mode, loc.coords.latitude, loc.coords.longitude, note);

    if (res.success) {
      Alert.alert("Inspeksi", "Inspeksi tercatat.");
      setPendingScan(null);
      setShowNoteInput(false);
      setScanMode(false);
      loadData();
    } else {
      Alert.alert("Gagal", res.message);
    }
  };

  if (pairingMode) {
    return <NfcPairingScreen onDone={() => { setPairingMode(false); loadData(); }} />;
  }

  if (qrBackupMode) {
    return <QrBackupScreen onDone={() => setQrBackupMode(false)} />;
  }

  if (scanMode) {
    return (
      <View style={{ flex: 1 }}>
        <CheckpointScanScreen
          inspectionMode
          onSessionStarted={(sessionId, name, scanMode) => {
            setPendingScan({ id: name, mode: scanMode });
            setShowNoteInput(true);
          }}
        />
        <Modal visible={showNoteInput} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Catatan Inspeksi</Text>
              <TextInput style={styles.modalInput} placeholder="Catatan (opsional)" value={inspectNote} onChangeText={setInspectNote} multiline />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowNoteInput(false); setInspectNote(""); }}>
                  <Text style={styles.modalCancelText}>Lewati</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={() => handleInspection(inspectNote || undefined)}>
                  <Text style={styles.modalConfirmText}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <TouchableOpacity style={styles.backFloating} onPress={() => setScanMode(false)}>
          <Text style={{ color: "#6b7280" }}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard Supervisor</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.logoutBtn}>Keluar</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["team", "inspections", "overrides", "photos"] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabActiveText]}>
              {t === "team" ? "Tim" : t === "inspections" ? "Inspeksi" : t === "overrides" ? "Override" : "Foto"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {/* Team Tab */}
        {tab === "team" && (
          <View>
            {team.map((m) => (
              <View key={m.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardName}>{m.name}</Text>
                  <Text style={[styles.cardStatus, m.checkedIn ? styles.statusIn : styles.statusOut]}>
                    {m.checkedIn ? "Check-in" : "Belum"}
                  </Text>
                </View>
                <Text style={styles.cardSub}>
                  {m.completedCheckpoints}/{m.totalCheckpoints} checkpoint selesai
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Inspections Tab */}
        {tab === "inspections" && (
          <View>
            <TouchableOpacity style={styles.inspectBtn} onPress={() => setScanMode(true)}>
              <Text style={styles.inspectBtnText}>Inspeksi Checkpoint</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pairBtn} onPress={() => setPairingMode(true)}>
              <Text style={styles.inspectBtnText}>Pasang NFC Tag</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.qrBackupBtn} onPress={() => setQrBackupMode(true)}>
              <Text style={styles.inspectBtnText}>QR Backup</Text>
            </TouchableOpacity>
            {inspections.map((ins) => (
              <View key={ins.id} style={styles.card}>
                <Text style={styles.cardName}>{ins.checkpointName}</Text>
                <Text style={styles.cardSub}>{new Date(ins.finishedAt).toLocaleString("id-ID")}</Text>
                {ins.note && <Text style={styles.cardNote}>{ins.note}</Text>}
              </View>
            ))}
            {inspections.length === 0 && <Text style={styles.empty}>Belum ada inspeksi</Text>}
          </View>
        )}

        {/* Overrides Tab */}
        {tab === "overrides" && (
          <View>
            {overrides.map((o) => (
              <View key={o.id} style={styles.card}>
                <Text style={styles.cardName}>{o.userName}</Text>
                <Text style={styles.cardSub}>{new Date(o.timestamp).toLocaleString("id-ID")}</Text>
                <Text style={styles.cardNote}>Alasan: {o.overrideReason}</Text>
              </View>
            ))}
            {overrides.length === 0 && <Text style={styles.empty}>Tidak ada override</Text>}
          </View>
        )}

        {/* Photos Tab */}
        {tab === "photos" && (
          <View>
            {lastPhotos.map((p) => (
              <View key={p.id} style={styles.card}>
                <Text style={styles.cardName}>{p.checkpointName}</Text>
                <Text style={styles.cardSub}>Cleaner: {p.cleanerName}</Text>
                <Text style={styles.cardSub}>Selesai: {new Date(p.finishedAt).toLocaleString("id-ID")}</Text>
                {p.beforePhotoUrl ? (
                  <Image source={{ uri: p.beforePhotoUrl }} style={styles.photoPreview} resizeMode="cover" />
                ) : null}
                {p.afterPhotoUrl ? (
                  <Image source={{ uri: p.afterPhotoUrl }} style={styles.photoPreview} resizeMode="cover" />
                ) : null}
              </View>
            ))}
            {lastPhotos.length === 0 && <Text style={styles.empty}>Belum ada foto</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 60, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  logoutBtn: { color: "#dc2626", fontSize: 14 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 20, paddingBottom: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 13, color: "#6b7280" },
  tabActiveText: { color: "#2563eb", fontWeight: "600" },
  content: { flex: 1, padding: 20 },
  inspectBtn: { backgroundColor: "#2563eb", borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 16 },
  pairBtn: { backgroundColor: "#059669", borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 16 },
  qrBackupBtn: { backgroundColor: "#7c3aed", borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 16 },
  inspectBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 8 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  cardStatus: { fontSize: 12, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusIn: { color: "#16a34a", backgroundColor: "#f0fdf4" },
  statusOut: { color: "#dc2626", backgroundColor: "#fef2f2" },
  cardSub: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  cardNote: { fontSize: 12, color: "#92400e", marginTop: 4, fontStyle: "italic" },
  empty: { textAlign: "center", color: "#9ca3af", paddingVertical: 40 },
  backFloating: { position: "absolute", top: 60, left: 20 },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 16, minHeight: 80, textAlignVertical: "top" },
  modalBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalCancel: { padding: 10 },
  modalCancelText: { color: "#6b7280", fontSize: 14 },
  modalConfirm: { backgroundColor: "#2563eb", borderRadius: 8, padding: 10, paddingHorizontal: 20 },
  modalConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  photoPreview: { width: "100%", height: 200, borderRadius: 8, marginTop: 8, backgroundColor: "#f3f4f6" },
});
