import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { uploadSessionPhoto, completeSession } from "../lib/checkpoint";

type Props = {
  sessionId: string;
  checkpointName: string;
  onComplete: () => void;
  onBack: () => void;
};

export default function CheckpointSessionScreen({ sessionId, checkpointName, onComplete, onBack }: Props) {
  const { user } = useAuth();
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"before" | "after" | "done">("before");

  const takePhoto = async (type: "before" | "after") => {
    // Testing: skip camera, langsung set placeholder
    if (type === "before") setBeforePhoto(`photo-before-${Date.now()}`);
    else setAfterPhoto(`photo-after-${Date.now()}`);
  };

  const handleBeforePhoto = async () => {
    if (!beforePhoto) return;
    setLoading(true);
    // Testing: skip upload, pakai placeholder
    const url = `https://placehold.co/640x480?text=Before-${Date.now()}`;
    const res = await uploadSessionPhoto(sessionId, "before", url);
    if (res.success) {
      setStep("after");
    } else {
      Alert.alert("Gagal", res.message);
    }
    setLoading(false);
  };

  const handleComplete = async () => {
    if (!afterPhoto) return;
    setLoading(true);
    // Testing: skip upload, pakai placeholder
    const url = `https://placehold.co/640x480?text=After-${Date.now()}`;
    const res = await completeSession(sessionId, url, 0, 0);
    if (res.success) {
      Alert.alert("Selesai", `Sesi selesai (${res.duration} menit)`);
      onComplete();
    } else {
      Alert.alert("Gagal", res.message);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12 }}>Memproses...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{checkpointName}</Text>
      <Text style={styles.subtitle}>Sesi Pembersihan</Text>

      {/* Step indicator */}
      <View style={styles.steps}>
        <View style={[styles.step, step === "before" && styles.stepActive]}>
          <Text style={[styles.stepNum, step === "before" && styles.stepNumActive]}>1</Text>
          <Text style={styles.stepLabel}>Foto Sebelum</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={[styles.step, step === "after" && styles.stepActive]}>
          <Text style={[styles.stepNum, step === "after" && styles.stepNumActive]}>2</Text>
          <Text style={styles.stepLabel}>Foto Sesudah</Text>
        </View>
      </View>

      {/* Before photo section */}
      {step === "before" && (
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Foto Kondisi Sebelum Dibersihkan</Text>
          {beforePhoto ? (
            <>
              <Image source={{ uri: beforePhoto }} style={styles.preview} />
              <TouchableOpacity style={styles.retakeBtn} onPress={() => setBeforePhoto(null)}>
                <Text style={styles.retakeText}>Ambil Ulang</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleBeforePhoto}>
                <Text style={styles.actionBtnText}>Simpan & Lanjut</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.cameraBtn} onPress={() => takePhoto("before")}>
              <Text style={styles.cameraBtnText}>Ambil Foto</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* After photo section */}
      {step === "after" && (
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Foto Kondisi Sesudah Dibersihkan</Text>
          {afterPhoto ? (
            <>
              <Image source={{ uri: afterPhoto }} style={styles.preview} />
              <TouchableOpacity style={styles.retakeBtn} onPress={() => setAfterPhoto(null)}>
                <Text style={styles.retakeText}>Ambil Ulang</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleComplete}>
                <Text style={styles.actionBtnText}>Selesaikan Sesi</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.cameraBtn} onPress={() => takePhoto("after")}>
              <Text style={styles.cameraBtnText}>Ambil Foto</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backText}>Kembali</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", color: "#111827" },
  subtitle: { fontSize: 14, textAlign: "center", color: "#6b7280", marginTop: 4, marginBottom: 24 },
  steps: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 32 },
  step: {
    width: 80, alignItems: "center", padding: 10, borderRadius: 10,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb",
  },
  stepActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, textAlign: "center", lineHeight: 28,
    fontSize: 14, fontWeight: "600", color: "#6b7280", backgroundColor: "#f3f4f6",
    overflow: "hidden",
  },
  stepNumActive: { color: "#fff", backgroundColor: "#2563eb" },
  stepLabel: { fontSize: 11, color: "#6b7280", marginTop: 4, textAlign: "center" },
  stepLine: { width: 40, height: 1, backgroundColor: "#d1d5db", marginHorizontal: 8 },
  photoSection: { alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 16, color: "#374151" },
  preview: { width: "100%", height: 300, borderRadius: 12, marginBottom: 12 },
  cameraBtn: {
    backgroundColor: "#2563eb", borderRadius: 12, padding: 16, width: "100%",
    alignItems: "center", marginBottom: 12,
  },
  cameraBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  retakeBtn: { padding: 8, marginBottom: 8 },
  retakeText: { color: "#6b7280", fontSize: 13 },
  actionBtn: {
    backgroundColor: "#16a34a", borderRadius: 12, padding: 16, width: "100%",
    alignItems: "center",
  },
  actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  backBtn: { marginTop: 24, alignItems: "center", padding: 12 },
  backText: { color: "#dc2626", fontSize: 14 },
});
