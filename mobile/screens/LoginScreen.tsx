import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen() {
  const { signInWithEmail, signInWithPhone } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleEmailLogin = async () => {
    setLoading(true);
    setMessage("");
    const error = await signInWithEmail(email, password);
    if (error) setMessage(error);
    setLoading(false);
  };

  const handlePhoneOTP = async () => {
    setLoading(true);
    setMessage("");
    const error = await signInWithPhone(`+62${phone}`);
    if (error) {
      setMessage(error);
    } else {
      setMessage("Kode OTP telah dikirim ke nomor Anda. Cek SMS.");
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.title}>FacilityOS</Text>
        <Text style={styles.subtitle}>
          Masuk ke sistem manajemen fasilitas
        </Text>

        {/* Email Login */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supervisor / Admin</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Kata Sandi"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, styles.emailButton]}
            onPress={handleEmailLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Masuk</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Phone OTP */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cleaner</Text>
          <View style={styles.phoneRow}>
            <Text style={styles.phonePrefix}>+62</Text>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="81234567890"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
          <TouchableOpacity
            style={[styles.button, styles.phoneButton]}
            onPress={handlePhoneOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Kirim Kode OTP</Text>
            )}
          </TouchableOpacity>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
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
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
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
  button: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  emailButton: {
    backgroundColor: "#2563eb",
  },
  phoneButton: {
    backgroundColor: "#16a34a",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  message: {
    textAlign: "center",
    color: "#dc2626",
    fontSize: 13,
  },
});
