import React from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import CleanerHomeScreen from "./screens/CleanerHomeScreen";
import SupervisorDashboardScreen from "./screens/SupervisorDashboardScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import WaitingAssignmentScreen from "./screens/WaitingAssignmentScreen";

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

  // Sudah isi data diri tapi belum punya site (cleaner/supervisor) → menunggu
  if (!hasSite && role !== "admin") return <WaitingAssignmentScreen />;

  if (role === "cleaner") return <CleanerHomeScreen />;
  if (role === "supervisor") return <SupervisorDashboardScreen />;
  return <DashboardScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </AuthProvider>
  );
}
