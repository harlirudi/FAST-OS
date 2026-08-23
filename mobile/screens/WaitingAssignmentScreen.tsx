import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";

export default function WaitingAssignmentScreen() {
  const { user, signOut } = useAuth();

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
          layar ini akan berubah otomatis.
        </Text>

        <Text style={styles.email}>{user?.email}</Text>

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
