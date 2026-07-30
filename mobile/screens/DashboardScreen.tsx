import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";

export default function DashboardScreen() {
  const { user, role, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.welcome}>
        Selamat datang, {user?.email || user?.phone || "Pengguna"}
      </Text>
      <Text style={styles.role}>Peran: {role || "unknown"}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Keluar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  welcome: {
    fontSize: 16,
    color: "#374151",
    marginTop: 8,
  },
  role: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  logoutButton: {
    marginTop: 32,
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  logoutText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
