import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage("");
    const error = await signInWithGoogle();
    if (error) setMessage(error);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.title}>FacilityOS</Text>
        <Text style={styles.subtitle}>Masuk ke sistem manajemen fasilitas</Text>

        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#374151" />
          ) : (
            <>
              <Text style={styles.googleLogo}>G</Text>
              <Text style={styles.googleText}>Masuk / Daftar dengan Google</Text>
            </>
          )}
        </TouchableOpacity>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Text style={styles.footer}>Gunakan akun Google kantor untuk masuk atau mendaftar.</Text>
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
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 32,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  googleLogo: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4285F4",
  },
  googleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  message: {
    textAlign: "center",
    color: "#dc2626",
    fontSize: 13,
    marginTop: 16,
  },
  footer: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 24,
  },
});
