import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert,
} from "react-native";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import { startSession } from "../lib/checkpoint";

export default function CheckpointScanScreen({ onSessionStarted, inspectionMode }: {
  onSessionStarted: (sessionId: string, checkpointName: string) => void;
  inspectionMode?: boolean;
}) {
  const [mode, setMode] = useState<"nfc" | "qr">("nfc");
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [nfcInput, setNfcInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode("qr");
  }, []);

  const handleScan = async (identifier: string) => {
    setLoading(true);
    setScanning(false);

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    if (inspectionMode) {
      // Jangan panggil API — supervisor dashboard handle di modal
      onSessionStarted(identifier, identifier);
      setLoading(false);
      return;
    }

    const res = await startSession(
      identifier,
      mode,
      loc.coords.latitude,
      loc.coords.longitude
    );

    if (res.success && res.sessionId) {
      Alert.alert("Berhasil", res.message);
      onSessionStarted(res.sessionId, res.checkpointName || "Checkpoint");
    } else {
      Alert.alert("Gagal", res.message);
    }
    setLoading(false);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    handleScan(data);
  };

  const handleNfcSubmit = () => {
    if (!nfcInput.trim()) return;
    handleScan(nfcInput.trim());
  };

  const handleSwitchToNfc = () => {
    setMode("nfc");
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Memproses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan Checkpoint</Text>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "nfc" && styles.modeActive]}
          onPress={handleSwitchToNfc}
        >
          <Text style={[styles.modeText, mode === "nfc" && styles.modeActiveText]}>NFC</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "qr" && styles.modeActive]}
          onPress={async () => {
            if (!permission?.granted) await requestPermission();
            setMode("qr");
            setScanning(true);
          }}
        >
          <Text style={[styles.modeText, mode === "qr" && styles.modeActiveText]}>QR Code</Text>
        </TouchableOpacity>
      </View>

      {mode === "nfc" && (
        <View style={styles.nfcContainer}>
          <Text style={styles.nfcHint}>
            NFC hanya tersedia di development build, bukan Expo Go. Input NFC Tag ID manual di sini.
          </Text>
          <TextInput style={styles.input} placeholder="Masukkan NFC Tag ID" value={nfcInput} onChangeText={setNfcInput} autoCapitalize="none" />
          <TouchableOpacity style={styles.scanBtn} onPress={handleNfcSubmit}>
            <Text style={styles.scanBtnText}>Scan NFC</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === "qr" && scanning && permission?.granted && (
        <View style={styles.qrContainer}>
          <CameraView
            style={styles.qrScanner}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <Text style={styles.qrHint}>Arahkan kamera ke QR Code checkpoint</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelText}>Batal</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === "qr" && !scanning && (
        <View style={styles.nfcContainer}>
          <Text style={styles.nfcHint}>QR Code scanner siap</Text>
          <TouchableOpacity style={styles.scanBtn} onPress={async () => {
            if (!permission?.granted) await requestPermission();
            setScanning(true);
          }}>
            <Text style={styles.scanBtnText}>Buka Scanner QR</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#6b7280" },
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginTop: 40, marginBottom: 24 },
  modeRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db" },
  modeActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  modeText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  modeActiveText: { color: "#fff" },
  nfcContainer: { alignItems: "center" },
  nfcHint: { fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 16 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 14, fontSize: 16, width: "100%", marginBottom: 16, textAlign: "center" },
  scanBtn: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32 },
  scanBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  qrContainer: { flex: 1, overflow: "hidden", borderRadius: 12 },
  qrScanner: { flex: 1 },
  qrHint: { textAlign: "center", color: "#fff", fontSize: 14, padding: 12, backgroundColor: "rgba(0,0,0,0.6)", position: "absolute", bottom: 80, left: 0, right: 0 },
  cancelBtn: { backgroundColor: "#fff", borderRadius: 8, padding: 12, alignItems: "center", marginTop: 12 },
  cancelText: { color: "#dc2626", fontWeight: "600" },
});
