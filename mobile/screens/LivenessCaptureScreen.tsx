import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useFaceDetection, RNMLKitFace } from "@infinitered/react-native-mlkit-face-detection";

const FRAME_DELAY_MS = 900;
const BLINK_CLOSED = 0.4;
const BLINK_OPEN = 0.6;
const MOTION_PX = 15;

type Frame = { uri: string; face: RNMLKitFace | null; eyeOpen: number | null };

// Anti-spoofing Level 3 (MVP): kamera inline mengambil 3 frame (±2 detik),
// user diminta berkedip. Foto statis (dicetak/di layar) tidak berkedip dan
// tidak bergerak → ditolak. Frame terbaik (wajah + mata terbuka) jadi foto resmi.
export default function LivenessCaptureScreen({
  onResult,
}: {
  onResult: (uri: string | null) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const faceDetector = useFaceDetection();
  const [capturing, setCapturing] = useState(false);
  const [step, setStep] = useState(0);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [message, setMessage] = useState("Bersiap...");

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const detectFaces = async (uri: string): Promise<RNMLKitFace[]> => {
    const result = await faceDetector.detectFaces(uri);
    return result?.faces ?? [];
  };

  const run = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setFrames([]);
    try {
      const captured: Frame[] = [];
      for (let i = 0; i < 3; i++) {
        setStep(i);
        setMessage(i === 1 ? "Berkedip sekali sekarang!" : "Tahan HP — jangan bergerak");
        await new Promise((r) => setTimeout(r, 500));
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true });
        if (!photo?.uri) throw new Error("Gagal mengambil foto");
        const faces = await detectFaces(photo.uri);
        const face = faces[0] ?? null;
        let eyeOpen: number | null = null;
        if (face && face.hasLeftEyeOpenProbability && face.hasRightEyeOpenProbability) {
          const l = face.leftEyeOpenProbability;
          const r = face.rightEyeOpenProbability;
          if (l != null && r != null) eyeOpen = (l + r) / 2;
        } else if (face?.hasLeftEyeOpenProbability && face.leftEyeOpenProbability != null) {
          eyeOpen = face.leftEyeOpenProbability;
        }
        captured.push({ uri: photo.uri, face, eyeOpen });
        setFrames([...captured]);
        if (i < 2) await new Promise((r) => setTimeout(r, FRAME_DELAY_MS));
      }

      const allHaveFace = captured.every((f) => f.face !== null);
      if (!allHaveFace) {
        Alert.alert("Gagal", "Wajah tidak terdeteksi di semua frame. Coba lagi dengan pencahayaan cukup.");
        return;
      }

      // 1) Kedipan: ada frame mata tertutup & ada frame mata terbuka
      const eyeValues = captured.map((f) => f.eyeOpen);
      const hasUsableEyes = eyeValues.some((v) => v !== null);
      const blinkDetected =
        hasUsableEyes &&
        eyeValues.some((v) => v !== null && v < BLINK_CLOSED) &&
        eyeValues.some((v) => v !== null && v > BLINK_OPEN);

      // 2) Gerakan: posisi wajah berubah antar frame (foto statis tidak bergerak)
      const centers = captured.map((f) =>
        f.face
          ? {
              x: f.face.frame.origin.x + f.face.frame.size.x / 2,
              y: f.face.frame.origin.y + f.face.frame.size.y / 2,
            }
          : null
      );
      const c0 = centers[0];
      const motionDetected =
        c0 !== null &&
        centers.some((c) => c !== null && c !== c0 && Math.hypot(c.x - c0.x, c.y - c0.y) > MOTION_PX);

      if (!blinkDetected && !motionDetected) {
        Alert.alert(
          "Verifikasi Gagal",
          "Kami tidak mendeteksi gerakan atau kedipan — sepertinya foto statis. Coba lagi: kedipkan mata dan gerakkan sedikit."
        );
        return;
      }

      // Frame terbaik: mata paling terbuka (atau frame pertama jika tidak tersedia)
      let best = captured[0];
      for (const f of captured) {
        if ((f.eyeOpen ?? 0) > (best.eyeOpen ?? 0)) best = f;
      }
      if (!best.face) { Alert.alert("Gagal", "Wajah tidak terdeteksi. Coba lagi."); return; }

      const compressed = await ImageManipulator.manipulateAsync(best.uri, [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });

      onResult(compressed.uri);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Terjadi kesalahan saat verifikasi");
    } finally {
      setCapturing(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Izin kamera diperlukan untuk check-in.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => requestPermission()}>
          <Text style={styles.btnText}>Izinkan Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onResult(null)}>
          <Text style={styles.cancel}>Batal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={"front" as CameraType}
      />
      <View style={styles.overlay}>
        <Text style={styles.stepText}>
          {capturing ? message : "Ketuk 'Mulai' — ikuti instruksi di layar (jangan foto/gambar)"}
        </Text>
        {capturing ? (
          <View style={styles.progressRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, i < frames.length && styles.dotDone, i === step && styles.dotActive]} />
            ))}
          </View>
        ) : null}
        {!capturing ? (
          <TouchableOpacity style={styles.btn} onPress={run}>
            <Text style={styles.btnText}>Mulai Verifikasi</Text>
          </TouchableOpacity>
        ) : (
          <ActivityIndicator color="#fff" size="large" />
        )}
        {!capturing && (
          <TouchableOpacity onPress={() => onResult(null)}>
            <Text style={styles.cancel}>Batal</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3f4f6", padding: 24 },
  hint: { fontSize: 14, color: "#6b7280", marginBottom: 20, textAlign: "center" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 32,
    paddingBottom: 80,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  stepText: { color: "#fff", fontSize: 15, fontWeight: "600", textAlign: "center", marginBottom: 16 },
  btn: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 16 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancel: { color: "#fff", fontSize: 14, marginTop: 8 },
  progressRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.35)" },
  dotActive: { backgroundColor: "#fbbf24" },
  dotDone: { backgroundColor: "#34d399" },
});
