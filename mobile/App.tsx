import React from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import CleanerHomeScreen from "./screens/CleanerHomeScreen";
import SupervisorDashboardScreen from "./screens/SupervisorDashboardScreen";

function AppNavigator() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!user) return <LoginScreen />;
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
