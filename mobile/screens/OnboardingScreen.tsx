import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useFaceDetection } from "@infinitered/react-native-mlkit-face-detection";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { uploadPhoto } from "../lib/attendance";

export default function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const faceDetector = useFaceDetection();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.full_name || user.user_metadata?.name || "");
    }
  }, [user]);

  // Foto selfie sebagai patokan wajah untuk check-in/check-out (face matching)
  const takeReferencePhoto = async () => {
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) { Alert.alert("Izin kamera ditolak"); return; }
      const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
      if (r.canceled || !r.assets?.[0]) return;

      const compressed = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });

      // Tunggu model ML Kit siap
      for (let i = 0; i < 50; i++) {
        if (faceDetector.status === "ready" || faceDetector.status === "error") break;
        await new Promise((res) => setTimeout(res, 100));
      }
      const result = await faceDetector.detectFaces(compressed.uri);
      if (!result?.faces || result.faces.length === 0) {
        Alert.alert("Foto tidak valid", "Wajah tidak terdeteksi. Harap gunakan foto selfie yang jelas.");
        return;
      }

      const url = await uploadPhoto(compressed.uri, `reference/${user!.id}`);
      if (!url) { Alert.alert("Gagal", "Foto gagal diunggah. Coba lagi."); return; }

      const { error } = await supabase
        .from("users")
        .update({ reference_photo_url: url })
        .eq("auth_id", user!.id);
      if (error) { Alert.alert("Gagal", error.message); return; }

      Alert.alert("Berhasil", "Foto patokan tersimpan. Check-in/check-out kamu akan diverifikasi dengan foto ini.", [
        { text: "OK", onPress: () => refreshProfile() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Terjadi kesalahan");
    }
  };

  const finishOnboarding = () => {
    refreshProfile();
    Alert.alert(
      "Foto Patokan Wajah",
      "Ambil foto selfie sekarang sebagai patokan verifikasi check-in/check-out?",
      [
        { text: "Nanti", style: "cancel", onPress: () => refreshProfile() },
        { text: "Ambil Foto", onPress: takeReferencePhoto },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Perhatian", "Nama tidak boleh kosong.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Perhatian", "Nomor HP wajib diisi.");
      return;
    }
    setSaving(true);

    // Cek record existing (dibuat trigger)
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user!.id)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("users")
        .update({ name: name.trim(), phone: phone.trim() })
        .eq("auth_id", user!.id));
    } else {
      ({ error } = await supabase.from("users").insert({
        auth_id: user!.id,
        name: name.trim(),
        phone: phone.trim(),
        role: "cleaner",
      }));
    }

    if (error) {
      Alert.alert("Gagal", error.message);
    } else {
      setSaved(true);
      finishOnboarding();
    }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Lengkapi Data Diri</Text>
        <Text style={styles.subtitle}>Satu langkah lagi sebelum mulai</Text>

        <Text style={styles.label}>Email (Google)</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={user?.email || ""}
          editable={false}
        />

        <Text style={styles.label}>Nama Lengkap</Text>
        <TextInput
          style={styles.input}
          placeholder="Nama lengkap kamu"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Nomor HP (WhatsApp)</Text>
        <View style={styles.phoneRow}>
          <Text style={styles.phonePrefix}>+62</Text>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder="81234567890"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ""))}
            keyboardType="phone-pad"
          />
        </View>
        <Text style={styles.phoneHint}>Dipakai admin/supervisor untuk menghubungi kamu.</Text>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Simpan & Lanjutkan</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    color: "#6b7280",
    marginTop: 6,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  disabledInput: {
    backgroundColor: "#f9fafb",
    color: "#9ca3af",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  phonePrefix: {
    fontSize: 14,
    color: "#6b7280",
    paddingRight: 8,
  },
  phoneInput: {
    flex: 1,
  },
  phoneHint: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 6,
  },
  saveBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
