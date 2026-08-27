import React, { useState } from "react";
import { ActivityIndicator, View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { FaceDetectionProvider } from "@infinitered/react-native-mlkit-face-detection";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import CleanerHomeScreen from "./screens/CleanerHomeScreen";
import SupervisorDashboardScreen from "./screens/SupervisorDashboardScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import WaitingAssignmentScreen from "./screens/WaitingAssignmentScreen";

// Supervisor: dua layar — Absensi (check-in/istirahat/check-out per site)
// dan Dashboard (tim/override/foto per site).
function SupervisorTabs() {
  const [tab, setTab] = useState<"attendance" | "dashboard">("attendance");
  return (
    <View style={{ flex: 1 }}>
      {tab === "attendance" ? (
        <CleanerHomeScreen checkpointType="cleaning" supervisorMode />
      ) : (
        <SupervisorDashboardScreen />
      )}
      <View style={styles.supervisorTabs}>
        <TouchableOpacity style={[styles.stab, tab === "attendance" && styles.stabActive]} onPress={() => setTab("attendance")}>
          <Text style={[styles.stabText, tab === "attendance" && styles.stabTextActive]}>Absensi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.stab, tab === "dashboard" && styles.stabActive]} onPress={() => setTab("dashboard")}>
          <Text style={[styles.stabText, tab === "dashboard" && styles.stabTextActive]}>Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AppNavigator() {
  const { user, role, hasProfile, hasSite, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  // Belum isi data diri (nama + HP) → onboarding
  if (!hasProfile) return <OnboardingScreen />;

  // Cleaner/security belum punya site → menunggu penugasan (dipantau otomatis tiap 30 detik)
  if ((role === "cleaner" || role === "security") && !hasSite) return <WaitingAssignmentScreen />;

  if (role === "cleaner") return <CleanerHomeScreen checkpointType="cleaning" />;
  if (role === "security") return <CleanerHomeScreen checkpointType="security" />;
  if (role === "supervisor") return <SupervisorTabs />;
  return <DashboardScreen />;
}

const styles = StyleSheet.create({
  supervisorTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingBottom: 24,
    paddingTop: 8,
  },
  stab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  stabActive: { backgroundColor: "#eff6ff" },
  stabText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  stabTextActive: { color: "#2563eb" },
});

export default function App() {
  return (
    <FaceDetectionProvider options={{ performanceMode: "accurate", classificationMode: true }}>
      <AuthProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </AuthProvider>
    </FaceDetectionProvider>
  );
}
