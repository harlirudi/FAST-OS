import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AppState } from "react-native";
import { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  role: string | null;
  hasProfile: boolean;
  hasSite: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const AUTH_TIMEOUT_MS = 60_000;

// Buka URL OAuth di browser lalu tunggu deep link balik ke app.
// Lebih andal daripada openAuthSessionAsync di build standalone Android
// (Chrome Custom Tab sering gagal menyerahkan hasil kembali ke app).
function waitForAuthCallback(authUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let subscription: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      subscription?.remove();
      resolve(url);
    };

    subscription = Linking.addEventListener("url", (event) => {
      finish(event.url);
    });

    // App mungkin di-kill Android lalu dibuka ulang oleh deep link
    Linking.getInitialURL().then((url) => {
      if (url && /[?&#]code=/.test(url)) finish(url);
    });

    Linking.openURL(authUrl).catch(() => finish(null));

    timer = setTimeout(() => finish(null), AUTH_TIMEOUT_MS);
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [hasSite, setHasSite] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setRole(null);
      setHasProfile(false);
      setHasSite(false);
      return;
    }
    const { data: dbUser } = await supabase
      .from("users")
      .select("role, phone, site_id")
      .eq("auth_id", authUser.id)
      .maybeSingle();
    setRole(dbUser?.role ?? null);
    setHasProfile(!!dbUser?.phone);
    setHasSite(!!dbUser?.site_id);
  }, []);

  useEffect(() => {
    // Deep link saat cold start (Android bisa meng-kill app saat login Google)
    Linking.getInitialURL().then((url) => {
      const code = url?.match(/[?&#]code=([^&]+)/)?.[1];
      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(() => refreshProfile());
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      refreshProfile().finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      refreshProfile();
    });

    // Refresh profil setiap kali app kembali ke foreground
    // (misal admin baru saja menugaskan site dari web)
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshProfile();
    });

    return () => {
      listener.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, [refreshProfile]);

  const signInWithGoogle = async () => {
    // Standalone APK: pakai App Link https (Android intercept URL ini ke app).
    // Custom scheme (facilityos://) diblokir Chrome saat redirect dari browser.
    // Dev client (Metro): pakai scheme facilityos seperti biasa.
    const redirectUri = __DEV__
      ? Linking.createURL("auth/callback")
      : "https://web-chi-cyan-20.vercel.app/auth/callback";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });
    if (error) return error.message;
    if (!data?.url) return "Tidak ada URL login Google";

    // Buka browser dan tunggu deep link balik (facilityos://auth/callback?code=...)
    const callbackUrl = await waitForAuthCallback(data.url);

    const code = callbackUrl?.match(/[?&#]code=([^&]+)/)?.[1];
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        // Kode mungkin sudah ditukar saat cold start — cek session dulu
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return exchangeError.message;
      }
    } else {
      // Tidak ada kode — cek apakah session sudah terbentuk di server
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return "Login tidak selesai. Coba lagi — setelah memilih akun Google, tunggu sampai kembali ke aplikasi otomatis.";
      }
    }

    await refreshProfile();
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user, role, hasProfile, hasSite, loading, signInWithGoogle, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
