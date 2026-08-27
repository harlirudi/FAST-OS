import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Vibration,
} from "react-native";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useFaceDetection, RNMLKitFace } from "@infinitered/react-native-mlkit-face-detection";

// Liveness TERPANDU:
//   1. "Pejamkan mata (±1 detik)" → app menunggu frame mata tertutup
//   2. Getaran singkat ("ceklek") → "Buka mata!" → tunggu mata terbuka
//   3. Ulangi sebanyak `rounds` (foto patokan: 2; check-in/out/istirahat: 1)
// Foto resmi = frame mata paling terbuka (untuk face matching), bukan frame tertutup.
const FRAME_DELAY_MS = 300;
const BLINK_CLOSED = 0.5;
const REOPEN_OPEN = 0.6;
// Batas frame percobaan per fase (timeout jika user tidak menutup/membuka mata)
const MAX_CLOSE_ATTEMPTS = 4;
const MAX_OPEN_ATTEMPTS = 3;
const DEFAULT_ROUNDS = 2;

type Frame = { uri: string; face: RNMLKitFace | null; eyeOpen: number | null };

// Anti-spoofing: kamera DEPAN inline. Setiap ronde DIPANDU: pejamkan mata
// (terdeteksi tertutup) → "ceklek" → buka mata. Foto statis tidak bisa
// menutup mata → ditolak. Face matching tetap dijalankan di server (AWS).
export default function LivenessCaptureScreen({
  onResult,
  rounds = DEFAULT_ROUNDS,
}: {
  onResult: (uri: string | null) => void;
  rounds?: number;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const faceDetector = useFaceDetection();
  const [capturing, setCapturing] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
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
    setPhotoProgress(0);
    try {
      const captured: Frame[] = [];
      let blinks = 0;
      let usableEyesSeen = false;
      let frameIndex = 0;

      // Ambil 1 frame + analisis wajah & mata. CATATAN: flag hasLeftEyeOpenProbability
      // tidak dikirim native (hanya ada di type TS) — cek nilai langsung (null = tidak tersedia).
      const takeFrame = async (): Promise<Frame> => {
        const photo = await cameraRef.current!.takePictureAsync({ quality: 0.8, skipProcessing: true });
        if (!photo?.uri) throw new Error("Gagal mengambil foto");
        const faces = await detectFaces(photo.uri);
        const face = faces[0] ?? null;
        let eyeOpen: number | null = null;
        if (face && face.leftEyeOpenProbability != null && face.rightEyeOpenProbability != null) {
          eyeOpen = (face.leftEyeOpenProbability + face.rightEyeOpenProbability) / 2;
        } else if (face?.leftEyeOpenProbability != null) {
          eyeOpen = face.leftEyeOpenProbability;
        }
        frameIndex++;
        // Debug: log tiap frame untuk tuning ambang per perangkat
        console.log(`[liveness] frame ${frameIndex} eyeOpen=${eyeOpen} l=${face?.leftEyeOpenProbability ?? "-"} r=${face?.rightEyeOpenProbability ?? "-"} face=${face ? "yes" : "no"} blinks=${blinks} round=${Math.min(blinks + 1, rounds)}`);
        return { uri: photo.uri, face, eyeOpen };
      };

      for (let round = 0; round < rounds; round++) {
        const photoNum = round + 1;
        setPhotoProgress(photoNum);

        // FASE 1: minta pejamkan mata, tunggu deteksi tertutup
        setMessage(`Foto ${photoNum}/${rounds} — Pejamkan mata (±1 detik)`);
        let closed = false;
        let closeAttempts = 0;
        while (!closed && closeAttempts < MAX_CLOSE_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, closeAttempts === 0 ? 500 : FRAME_DELAY_MS));
          const f = await takeFrame();
          captured.push(f);
          if (f.eyeOpen !== null) {
            usableEyesSeen = true;
            if (f.eyeOpen < BLINK_CLOSED) closed = true;
          }
          closeAttempts++;
        }
        if (!closed) {
          Alert.alert(
            "Verifikasi Gagal",
            usableEyesSeen
              ? "Mata tertutup tidak terdeteksi. Coba lagi — pejamkan mata selama ±1 detik saat diminta."
              : "Data probabilitas mata tidak tersedia di perangkat ini, sehingga kedipan tidak bisa diverifikasi. Coba lagi di perangkat lain."
          );
          return;
        }
        blinks++;

        // FASE 2: "ceklek" (getaran singkat) → minta buka mata, tunggu terbuka
        try { Vibration.vibrate(120); } catch {}
        setMessage(`Foto ${photoNum}/${rounds} — Buka mata!`);
        let openAttempts = 0;
        let opened = false;
        while (!opened && openAttempts < MAX_OPEN_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, FRAME_DELAY_MS));
          const f = await takeFrame();
          captured.push(f);
          if (f.eyeOpen !== null && f.eyeOpen > REOPEN_OPEN) opened = true;
          openAttempts++;
        }
      }

      if (blinks < rounds) {
        Alert.alert("Verifikasi Gagal", "Kedipan tidak cukup terdeteksi. Coba lagi.");
        return;
      }

      const allHaveFace = captured.every((f) => f.face !== null);
      if (!allHaveFace) {
        Alert.alert("Gagal", "Wajah tidak terdeteksi di semua frame. Coba lagi dengan pencahayaan cukup.");
        return;
      }

      // Frame terbaik: mata paling terbuka (foto resmi untuk face matching)
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
      <View style={styles.frontBadge}>
        <Text style={styles.frontBadgeText}>Kamera Depan</Text>
      </View>
      <View style={styles.overlay}>
        <Text style={styles.stepText}>
          {capturing
            ? message
            : "Kamera depan — posisikan wajah di tengah layar, lalu ikuti instruksi (bukan foto/gambar)"}
        </Text>{capturing ? (
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>Foto {photoProgress}/{rounds}</Text>
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
  frontBadge: {
    position: "absolute", top: 60, alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 6, zIndex: 10,
  },
  frontBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
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
  progressRow: { flexDirection: "row", gap: 10, marginBottom: 16, alignItems: "center" },
  progressText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.35)" },
  dotActive: { backgroundColor: "#fbbf24" },
  dotDone: { backgroundColor: "#34d399" },
});
