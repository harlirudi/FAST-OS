import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useAuth } from "../contexts/AuthContext";

const POLL_INTERVAL_MS = 30_000;

export default function WaitingAssignmentScreen() {
  const { user, refreshProfile, signOut } = useAuth();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    await refreshProfile();
    setLastChecked(new Date());
    setChecking(false);
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.title}>Menunggu Penugasan</Text>
        <Text style={styles.text}>
          Akun kamu sudah terdaftar, tapi belum ditugaskan ke site manapun.
        </Text>
        <Text style={styles.text}>
          Hubungi supervisor atau admin untuk penugasan. Setelah ditugaskan,
          aplikasi ini akan membuka layar kerja secara otomatis.
        </Text>

        <Text style={styles.email}>{user?.email}</Text>

        <TouchableOpacity
          style={styles.checkBtn}
          onPress={check}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.checkBtnText}>Periksa Sekarang</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.lastChecked}>
          {lastChecked
            ? `Terakhir diperiksa ${lastChecked.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })} — diperiksa otomatis tiap 30 detik`
            : "Memeriksa status penugasan..."}
        </Text>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Keluar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#b45309",
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 10,
  },
  email: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 12,
    marginBottom: 24,
  },
  checkBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    backgroundColor: "#2563eb",
  },
  checkBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  lastChecked: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 10,
    marginBottom: 24,
    textAlign: "center",
  },
  signOutBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
  },
  signOutText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "600",
  },
});
