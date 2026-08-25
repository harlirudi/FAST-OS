import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Modal, TextInput, ScrollView, Image,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useFaceDetection } from "@infinitered/react-native-mlkit-face-detection";
import { useAuth } from "../contexts/AuthContext";
import { getAttendanceStatus, submitAttendance, uploadPhoto } from "../lib/attendance";
import { getTodaySessions, CheckpointSession } from "../lib/checkpoint";
import { getPendingCount, onPendingChange, getPendingItems, PendingItem } from "../lib/sync";
import CheckpointScanScreen from "./CheckpointScanScreen";
import CheckpointSessionScreen from "./CheckpointSessionScreen";

type Screen = "home" | "scan" | "session";

export default function CleanerHomeScreen({ checkpointType = "cleaning" }: { checkpointType?: "cleaning" | "security" }) {
  const { user, name, signOut } = useAuth();
  const faceDetector = useFaceDetection();
  const [screen, setScreen] = useState<Screen>("home");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [siteName, setSiteName] = useState<string | null>(null);
  const [completedCP, setCompletedCP] = useState(0);
  const [totalCP, setTotalCP] = useState(0);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [sessions, setSessions] = useState<CheckpointSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeCheckpointName, setActiveCheckpointName] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [pendingAction, setPendingAction] = useState<"check_in" | "check_out" | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState("");
  const [pendingLoc, setPendingLoc] = useState<{ lat: number; lng: number } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const [status, todaySessions] = await Promise.all([
      getAttendanceStatus(checkpointType),
      getTodaySessions(checkpointType),
    ]);
    setCheckedIn(status.checkedIn);
    setSiteName(status.siteName);
    setCompletedCP(status.completedCheckpoints);
    setTotalCP(status.totalCheckpoints);
    setSessions(todaySessions);
    setLoading(false);
  }, [checkpointType]);

  // Foto dari kamera → kompres lokal → deteksi wajah (ML Kit) → upload.
  // Foto tanpa wajah DITOLAK (anti foto sembarang) — check-in tidak lanjut.
  // Catatan: di Android, hasil detectFaces TIDAK punya field `success`
  // (hanya faces + imagePath) — jadi cek faces.length, bukan result.success.
  const captureAndVerifyPhoto = async (): Promise<string | null> => {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) throw new Error("Izin kamera ditolak");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (r.canceled || !r.assets?.[0]) return null;

    const compressed = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });

    // Tunggu model ML Kit siap (maks ±5 detik)
    for (let i = 0; i < 50; i++) {
      if (faceDetector.status === "ready" || faceDetector.status === "error") break;
      await new Promise((res) => setTimeout(res, 100));
    }

    let faces;
    try {
      const result = await faceDetector.detectFaces(compressed.uri);
      faces = result?.faces ?? [];
    } catch (e: any) {
      Alert.alert("Gagal Deteksi", "Deteksi wajah tidak berfungsi saat ini. Coba lagi.");
      return null;
    }

    if (faces.length === 0) {
      Alert.alert(
        "Foto tidak valid",
        "Wajah tidak terdeteksi pada foto. Harap gunakan foto selfie Anda untuk check-in/check-out."
      );
      return null;
    }

    // Validasi posisi wajah agar selfie selalu pada frame yang wajar
    const img = await new Promise<{ width: number; height: number } | null>((resolve) => {
      Image.getSize(compressed.uri, (width, height) => resolve({ width, height }), () => resolve(null));
    });
    if (img) {
      const frame = faces[0].frame;
      const fw = frame.size.x;
      const fh = frame.size.y;
      const fcX = frame.origin.x + fw / 2;
      const fcY = frame.origin.y + fh / 2;
      const faceWideEnough = fw >= img.width * 0.15 && fh >= img.height * 0.15;
      const centered = Math.abs(fcX - img.width / 2) <= img.width * 0.4
        && Math.abs(fcY - img.height / 2) <= img.height * 0.4;
      if (!faceWideEnough || !centered) {
        Alert.alert(
          "Posisi Wajah",
          "Posisikan wajah di tengah bingkai, cukup dekat dengan kamera (selfie), lalu coba lagi."
        );
        return null;
      }
    }

    const url = await uploadPhoto(compressed.uri, user!.id);
    if (!url) {
      Alert.alert("Gagal", "Foto gagal diunggah. Periksa koneksi lalu coba lagi.");
      return null;
    }
    return url;
  };

  const doSubmit = async (type: "check_in" | "check_out", photoUrl: string, loc: { lat: number; lng: number }, reason?: string) => {
    const res = await submitAttendance(type, loc.lat, loc.lng, photoUrl, reason);
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

  const handleAttendance = async (type: "check_in" | "check_out") => {
    setActionLoading(true);
    try {
      const photoUrl = await captureAndVerifyPhoto();
      if (!photoUrl) return;
      const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await doSubmit(type, photoUrl, { lat: l.coords.latitude, lng: l.coords.longitude });
    } catch (e: any) {
      if (e.message !== "Dibatalkan") Alert.alert("Error", e.message);
    } finally {
      // Pastikan tombol selalu aktif kembali — termasuk saat foto dibatalkan/ditolak
      setActionLoading(false);
    }
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

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { getPendingCount().then(setPendingCount); getPendingItems().then(setPendingItems);
    return onPendingChange(c => { setPendingCount(c); getPendingItems().then(setPendingItems); }); }, []);

  if (screen === "scan") return <View style={{flex:1}}><CheckpointScanScreen onSessionStarted={handleSessionStarted} /><TouchableOpacity style={{position:"absolute",top:60,left:20}} onPress={()=>setScreen("home")}><Text style={{color:"#6b7280"}}>Kembali</Text></TouchableOpacity></View>;
  if (screen === "session" && activeSessionId) return <CheckpointSessionScreen sessionId={activeSessionId} checkpointName={activeCheckpointName} onComplete={handleSessionDone} onBack={()=>setScreen("home")} />;
  if (loading) return <View style={S.center}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <View style={S.headerRow}>
        <View><Text style={S.greeting}>Halo, {name || "Cleaner"}!</Text><Text style={S.site}>{siteName||"Belum ditugaskan"}</Text></View>
        {pendingCount>0 && <View style={S.badge}><Text style={S.badgeText}>{pendingCount} pending</Text></View>}
      </View>
      <View style={S.statusCard}>
        <View style={S.statusRow}><Text style={S.statusLabel}>Status</Text><Text style={[S.statusValue,checkedIn?S.statusIn:S.statusOut]}>{checkedIn?"Sudah Check-in":"Belum Check-in"}</Text></View>
        <View style={S.statusRow}><Text style={S.statusLabel}>Checkpoint</Text><Text style={S.progressValue}>{completedCP}/{totalCP} selesai</Text></View>
      </View>
      <TouchableOpacity style={[S.mainBtn,checkedIn?S.checkoutBtn:S.checkinBtn,actionLoading&&S.btnDisabled]} onPress={()=>handleAttendance(checkedIn?"check_out":"check_in")} disabled={actionLoading}>
        {actionLoading?<ActivityIndicator color="#fff"/>:<Text style={S.mainBtnText}>{checkedIn?"Check-Out":"Check-In"}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={[S.scanBtn,!checkedIn&&S.btnDisabled]} onPress={()=>setScreen("scan")} disabled={!checkedIn}><Text style={S.scanBtnText}>Scan Checkpoint</Text></TouchableOpacity>
      <View style={S.sec}><Text style={S.secTitle}>Riwayat Hari Ini</Text>
        {sessions.length===0?<Text style={S.empty}>Belum ada sesi.</Text>:sessions.map(s=><TouchableOpacity key={s.id} style={S.sCard} onPress={s.status==="in_progress"?()=>{setActiveSessionId(s.id);setActiveCheckpointName(s.checkpoints?.name||"CP");setScreen("session");}:undefined}><View style={{flex:1}}><Text style={S.sName}>{s.checkpoints?.name||"CP"}</Text><Text style={S.sTime}>{new Date(s.started_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}{s.duration_minutes?` — ${s.duration_minutes}m`:""}</Text></View><Text style={[S.sStat,s.status==="completed"?S.sDone:s.status==="in_progress"?S.sProg:S.sExp]}>{s.status==="completed"?"Selesai":s.status==="in_progress"?"Berjalan":"Kedaluwarsa"}</Text></TouchableOpacity>)}
      </View>
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
  statusCard:{backgroundColor:"#fff",borderRadius:12,padding:20,marginBottom:24,elevation:2},
  statusRow:{flexDirection:"row",justifyContent:"space-between",marginBottom:12},statusLabel:{fontSize:14,color:"#6b7280"},
  statusValue:{fontSize:14,fontWeight:"600"},statusIn:{color:"#16a34a"},statusOut:{color:"#dc2626"},
  progressValue:{fontSize:14,fontWeight:"600",color:"#2563eb"},
  mainBtn:{borderRadius:16,padding:24,alignItems:"center",marginBottom:12,elevation:4},
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
