import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Modal, TextInput, ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { useAuth } from "../contexts/AuthContext";
import { getAttendanceStatus, submitAttendance, uploadPhoto } from "../lib/attendance";
import { getTodaySessions, CheckpointSession } from "../lib/checkpoint";
import { getPendingCount, onPendingChange, getPendingItems, PendingItem } from "../lib/sync";
import CheckpointScanScreen from "./CheckpointScanScreen";
import CheckpointSessionScreen from "./CheckpointSessionScreen";
import LivenessCaptureScreen from "./LivenessCaptureScreen";

type Screen = "home" | "scan" | "session" | "liveness";

export default function CleanerHomeScreen({ checkpointType = "cleaning", supervisorMode = false }: { checkpointType?: "cleaning" | "security"; supervisorMode?: boolean }) {
  const { user, name, sites, signOut } = useAuth();
  const [screen, setScreen] = useState<Screen>("home");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [sitePickerOpen, setSitePickerOpen] = useState(false);
  const [siteName, setSiteName] = useState<string | null>(null);
  const [siteLat, setSiteLat] = useState<number | null>(null);
  const [siteLng, setSiteLng] = useState<number | null>(null);
  const [siteRadius, setSiteRadius] = useState<number | null>(null);
  const [completedCP, setCompletedCP] = useState(0);
  const [totalCP, setTotalCP] = useState(0);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [sessions, setSessions] = useState<CheckpointSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeCheckpointName, setActiveCheckpointName] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [pendingAction, setPendingAction] = useState<"check_in" | "check_out" | "break_start" | "break_end" | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState("");
  const [pendingLoc, setPendingLoc] = useState<{ lat: number; lng: number } | null>(null);

  const [pendingAttendanceType, setPendingAttendanceType] = useState<"check_in" | "check_out" | "break_start" | "break_end" | null>(null);
  const [livenessMode, setLivenessMode] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const [status, todaySessions] = await Promise.all([
      getAttendanceStatus(checkpointType, selectedSiteId ?? undefined),
      getTodaySessions(checkpointType),
    ]);
    setCheckedIn(status.checkedIn);
    setOnBreak(status.onBreak);
    setSiteName(status.siteName);
    setSiteLat(status.siteLat);
    setSiteLng(status.siteLng);
    setSiteRadius(status.siteRadius);
    setCompletedCP(status.completedCheckpoints);
    setTotalCP(status.totalCheckpoints);
    setSessions(todaySessions);
    setLoading(false);
  }, [checkpointType, selectedSiteId]);

  // Default pilih site pertama (untuk multi-site: user pilih sebelum check-in)
  useEffect(() => {
    if (!selectedSiteId && sites.length > 0) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites]);

  // Verifikasi liveness (anti foto statis): kamera inline 3 frame + kedipan/gerakan.
  // Frame terbaik sudah terkompres & terverifikasi wajah oleh LivenessCaptureScreen.
  const handleLivenessResult = async (uri: string | null) => {
    setLivenessMode(false);
    try {
      const type = pendingAttendanceType;
      setPendingAttendanceType(null);
      if (!uri || !type) return;
      // Foto lokal langsung dikirim ke edge (base64) — server menyimpan hanya jika flagged
      const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await doSubmit(type, uri, { lat: l.coords.latitude, lng: l.coords.longitude });
    } catch (e: any) {
      if (e.message !== "Dibatalkan") Alert.alert("Error", e.message);
    }
  };

  const doSubmit = async (type: "check_in" | "check_out" | "break_start" | "break_end", photoUrl: string, loc: { lat: number; lng: number }, reason?: string) => {
    const res = await submitAttendance(type, loc.lat, loc.lng, photoUrl, reason, selectedSiteId ?? undefined);
    if (res.success) {
      Alert.alert("Berhasil", res.message);
      await loadStatus();
      return true;
    }
    if (res.message.includes("m dari site")) {
      setPendingAction(type);
      setPendingPhotoUrl(photoUrl);
      setPendingLoc(loc);
      setShowOverride(true);
      return false;
    }
    Alert.alert("Gagal", res.message);
    return false;
  };

  const handleAttendance = async (type: "check_in" | "check_out" | "break_start" | "break_end") => {
    // Buka kamera liveness (3 frame + kedipan) — anti foto statis
    setPendingAttendanceType(type);
    setLivenessMode(true);
  };

  const handleOverride = async () => {
    if (!overrideReason.trim()) { Alert.alert("Isi alasan"); return; }
    if (!pendingAction || !pendingPhotoUrl || !pendingLoc) return;
    setShowOverride(false);
    setActionLoading(true);
    try {
      await doSubmit(pendingAction, pendingPhotoUrl, pendingLoc, overrideReason.trim());
    } finally {
      setOverrideReason("");
      setActionLoading(false);
    }
  };

  const handleSessionStarted = (sId: string, cpName: string) => { setActiveSessionId(sId); setActiveCheckpointName(cpName); setScreen("session"); };
  const handleSessionDone = async () => { setScreen("home"); await loadStatus(); };

  // Deteksi GPS di luar area: jika masih check-in (kerja) tapi HP >5 menit di luar
  // radius site → prompt catat istirahat. Hanya berjalan saat app di layar home.
  useEffect(() => {
    if (!checkedIn || onBreak || screen !== "home" || siteLat == null || siteLng == null || siteRadius == null) return;
    let outsideSince: number | null = null;
    let promptShown = false;
    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const OUTSIDE_MS = 5 * 60 * 1000;

    const check = async () => {
      if (promptShown) return;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const dist = haversine(loc.coords.latitude, loc.coords.longitude, siteLat, siteLng);
        if (dist > siteRadius) {
          outsideSince = outsideSince ?? Date.now();
          if (Date.now() - outsideSince >= OUTSIDE_MS) {
            promptShown = true;
            Alert.alert(
              "Di Luar Area",
              `HP kamu di luar area site (${siteName}) lebih dari 5 menit. Catat sebagai istirahat?`,
              [
                { text: "Saya masih di sini", style: "cancel", onPress: () => { outsideSince = null; promptShown = false; } },
                { text: "Catat Istirahat", onPress: () => handleAttendance("break_start") },
              ]
            );
          }
        } else {
          outsideSince = null;
        }
      } catch {}
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedIn, onBreak, screen, siteLat, siteLng, siteRadius, siteName]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { getPendingCount().then(setPendingCount); getPendingItems().then(setPendingItems);
    return onPendingChange(c => { setPendingCount(c); getPendingItems().then(setPendingItems); }); }, []);

  if (screen === "scan") return <View style={{flex:1}}><CheckpointScanScreen onSessionStarted={handleSessionStarted} /><TouchableOpacity style={{position:"absolute",top:60,left:20}} onPress={()=>setScreen("home")}><Text style={{color:"#6b7280"}}>Kembali</Text></TouchableOpacity></View>;
  if (screen === "session" && activeSessionId) return <CheckpointSessionScreen sessionId={activeSessionId} checkpointName={activeCheckpointName} onComplete={handleSessionDone} onBack={()=>setScreen("home")} />;
  if (livenessMode && pendingAttendanceType) return <LivenessCaptureScreen onResult={handleLivenessResult} rounds={1} />;
  if (loading) return <View style={S.center}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <View style={S.headerRow}>
        <View><Text style={S.greeting}>Halo, {name || "Cleaner"}!</Text><Text style={S.site}>{siteName||"Belum ditugaskan"}</Text></View>
        {pendingCount>0 && <View style={S.badge}><Text style={S.badgeText}>{pendingCount} pending</Text></View>}
      </View>
      {sites.length > 1 && (
        <View style={S.siteBar}>
          <TouchableOpacity style={S.siteSelect} onPress={() => setSitePickerOpen(true)}>
            <Text style={S.siteSelectText} numberOfLines={1}>
              {sites.find((s) => s.id === selectedSiteId)?.name ?? "Pilih site"}
            </Text>
            <Text style={S.siteSelectChevron}>▾</Text>
          </TouchableOpacity>
          <Modal visible={sitePickerOpen} transparent animationType="fade" onRequestClose={() => setSitePickerOpen(false)}>
            <TouchableOpacity style={S.dropdownOverlay} activeOpacity={1} onPress={() => setSitePickerOpen(false)}>
              <View style={S.dropdownCard}>
                {sites.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[S.dropdownItem, selectedSiteId === s.id && S.dropdownItemActive]}
                    onPress={() => { setSelectedSiteId(s.id); setSitePickerOpen(false); }}
                  >
                    <Text style={[S.dropdownItemText, selectedSiteId === s.id && S.dropdownItemTextActive]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}
      <View style={S.statusCard}>
        <View style={S.statusRow}><Text style={S.statusLabel}>Status</Text>
          <Text style={[S.statusValue, onBreak ? S.statusBreak : checkedIn ? S.statusIn : S.statusOut]}>
            {onBreak ? "Beristirahat" : checkedIn ? "Sudah Check-in" : "Belum Check-in"}
          </Text>
        </View>
        {!supervisorMode && (
          <View style={S.statusRow}><Text style={S.statusLabel}>Checkpoint</Text><Text style={S.progressValue}>{completedCP}/{totalCP} selesai</Text></View>
        )}
      </View>

      {!checkedIn ? (
        <TouchableOpacity style={[S.mainBtn, S.checkinBtn, actionLoading && S.btnDisabled]}
          onPress={() => handleAttendance("check_in")} disabled={actionLoading}>
          {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={S.mainBtnText}>Check-In</Text>}
        </TouchableOpacity>
      ) : onBreak ? (
        <TouchableOpacity style={[S.mainBtn, S.checkinBtn, actionLoading && S.btnDisabled]}
          onPress={() => handleAttendance("break_end")} disabled={actionLoading}>
          {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={S.mainBtnText}>Kembali</Text>}
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity style={[S.breakBtn, actionLoading && S.btnDisabled]}
            onPress={() => handleAttendance("break_start")} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={S.mainBtnText}>Istirahat</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[S.mainBtn, S.checkoutBtn, actionLoading && S.btnDisabled]}
            onPress={() => handleAttendance("check_out")} disabled={actionLoading}>
            <Text style={S.mainBtnText}>Check-Out</Text>
          </TouchableOpacity>
        </>
      )}
      {!supervisorMode && (
        <TouchableOpacity style={[S.scanBtn, (!checkedIn || onBreak) && S.btnDisabled]} onPress={() => setScreen("scan")} disabled={!checkedIn || onBreak}><Text style={S.scanBtnText}>Scan Checkpoint</Text></TouchableOpacity>
      )}
      {!supervisorMode && (
      <View style={S.sec}><Text style={S.secTitle}>Riwayat Hari Ini</Text>
        {sessions.length===0?<Text style={S.empty}>Belum ada sesi.</Text>:sessions.map(s=><TouchableOpacity key={s.id} style={S.sCard} onPress={s.status==="in_progress"?()=>{setActiveSessionId(s.id);setActiveCheckpointName(s.checkpoints?.name||"CP");setScreen("session");}:undefined}><View style={{flex:1}}><Text style={S.sName}>{s.checkpoints?.name||"CP"}</Text><Text style={S.sTime}>{new Date(s.started_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}{s.duration_minutes?` — ${s.duration_minutes}m`:""}</Text></View><Text style={[S.sStat,s.status==="completed"?S.sDone:s.status==="in_progress"?S.sProg:S.sExp]}>{s.status==="completed"?"Selesai":s.status==="in_progress"?"Berjalan":"Kedaluwarsa"}</Text></TouchableOpacity>)}
      </View>
      )}
      {pendingItems.length>0 && <View style={S.sec}><Text style={S.secTitle}>Antrian Sinkronisasi</Text>{pendingItems.map((p,i)=><View key={i} style={[S.sCard,{flexDirection:"row",justifyContent:"space-between"}]}><View><Text style={{fontSize:13,fontWeight:"600"}}>{p.label}</Text><Text style={{fontSize:11,color:"#9ca3af"}}>{new Date(p.createdAt).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</Text></View><Text style={{fontSize:11,fontWeight:"600",paddingHorizontal:8,paddingVertical:3,borderRadius:6,color:p.synced?"#16a34a":"#d97706",backgroundColor:p.synced?"#f0fdf4":"#fef3c7"}}>{p.synced?"Tersinkron":"Tersimpan lokal"}</Text></View>)}</View>}
      <TouchableOpacity style={S.logoutBtn} onPress={signOut}><Text style={S.logoutText}>Keluar</Text></TouchableOpacity>
      <Modal visible={showOverride} transparent animationType="fade">
        <View style={S.modalOverlay}><View style={S.modalCard}>
          <Text style={S.modalTitle}>Di Luar Area Site</Text><Text style={S.modalText}>Berikan alasan:</Text>
          <TextInput style={S.modalInput} placeholder="GPS tidak akurat" value={overrideReason} onChangeText={setOverrideReason} multiline />
          <View style={{flexDirection:"row",justifyContent:"flex-end",gap:8}}>
            <TouchableOpacity onPress={()=>{setShowOverride(false);setOverrideReason("");}}><Text style={{color:"#6b7280",padding:10}}>Batal</Text></TouchableOpacity>
            <TouchableOpacity style={{backgroundColor:"#2563eb",borderRadius:8,padding:10,paddingHorizontal:20}} onPress={handleOverride}><Text style={{color:"#fff",fontWeight:"600"}}>Lanjutkan</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container:{flex:1,backgroundColor:"#f3f4f6"},content:{padding:20,paddingTop:60},center:{flex:1,justifyContent:"center",alignItems:"center"},
  headerRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24},
  greeting:{fontSize:22,fontWeight:"bold",color:"#111827"},site:{fontSize:14,color:"#6b7280",marginTop:4},
  badge:{backgroundColor:"#fef3c7",borderRadius:12,paddingHorizontal:10,paddingVertical:4},badgeText:{color:"#92400e",fontSize:12,fontWeight:"600"},
  siteBar: { marginBottom: 16, alignItems: "flex-start" },
  siteSelect: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff",
    maxWidth: 220,
  },
  siteSelectText: { fontSize: 14, fontWeight: "600", color: "#111827", flexShrink: 1 },
  siteSelectChevron: { fontSize: 12, color: "#6b7280", marginLeft: 10 },
  dropdownOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-start", padding: 20 },
  dropdownCard: { backgroundColor: "#fff", borderRadius: 10, padding: 6, width: 240, elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8 },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
  dropdownItemActive: { backgroundColor: "#eff6ff" },
  dropdownItemText: { fontSize: 15, color: "#374151" },
  dropdownItemTextActive: { color: "#2563eb", fontWeight: "700" },
  statusCard:{backgroundColor:"#fff",borderRadius:12,padding:20,marginBottom:24,elevation:2},
  statusRow:{flexDirection:"row",justifyContent:"space-between",marginBottom:12},statusLabel:{fontSize:14,color:"#6b7280"},
  statusValue:{fontSize:14,fontWeight:"600"},statusIn:{color:"#16a34a"},statusOut:{color:"#dc2626"},statusBreak:{color:"#d97706"},
  progressValue:{fontSize:14,fontWeight:"600",color:"#2563eb"},
  mainBtn:{borderRadius:16,padding:24,alignItems:"center",marginBottom:12,elevation:4},
  breakBtn:{backgroundColor:"#d97706",borderRadius:16,padding:24,alignItems:"center",marginBottom:12,elevation:4},
  checkinBtn:{backgroundColor:"#16a34a"},checkoutBtn:{backgroundColor:"#dc2626"},btnDisabled:{opacity:.6},
  mainBtnText:{color:"#fff",fontSize:20,fontWeight:"bold"},
  scanBtn:{backgroundColor:"#2563eb",borderRadius:12,padding:16,alignItems:"center",marginBottom:24,elevation:2},scanBtnText:{color:"#fff",fontSize:16,fontWeight:"600"},
  sec:{marginBottom:24},secTitle:{fontSize:16,fontWeight:"600",color:"#111827",marginBottom:12},empty:{color:"#9ca3af",textAlign:"center",paddingVertical:20},
  sCard:{backgroundColor:"#fff",borderRadius:10,padding:14,marginBottom:8,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  sName:{fontSize:14,fontWeight:"600",color:"#111827"},sTime:{fontSize:12,color:"#6b7280",marginTop:2},
  sStat:{fontSize:12,fontWeight:"600",paddingHorizontal:8,paddingVertical:3,borderRadius:6},
  sDone:{color:"#16a34a",backgroundColor:"#f0fdf4"},sProg:{color:"#2563eb",backgroundColor:"#eff6ff"},sExp:{color:"#dc2626",backgroundColor:"#fef2f2"},
  logoutBtn:{padding:14,alignItems:"center"},logoutText:{color:"#6b7280"},
  modalOverlay:{flex:1,justifyContent:"center",alignItems:"center",backgroundColor:"rgba(0,0,0,0.5)",padding:24},
  modalCard:{backgroundColor:"#fff",borderRadius:12,padding:24,width:"100%"},
  modalTitle:{fontSize:18,fontWeight:"bold",marginBottom:8},modalText:{fontSize:14,color:"#6b7280",marginBottom:12},
  modalInput:{borderWidth:1,borderColor:"#d1d5db",borderRadius:8,padding:12,marginBottom:16,minHeight:80,textAlignVertical:"top"},
});
