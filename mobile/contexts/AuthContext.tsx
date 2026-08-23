import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AppState } from "react-native";
import { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { supabase } from "../lib/supabase";
import { GOOGLE_WEB_CLIENT_ID } from "../lib/google-config";

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
});

type AuthContextType = {
  session: Session | null;
  user: User | null;
  name: string | null;
  role: string | null;
  hasProfile: boolean;
  hasSite: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [hasSite, setHasSite] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setName(null);
      setRole(null);
      setHasProfile(false);
      setHasSite(false);
      return;
    }
    const { data: dbUser } = await supabase
      .from("users")
      .select("name, role, phone, site_id")
      .eq("auth_id", authUser.id)
      .maybeSingle();
    setName(dbUser?.name ?? null);
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
    // Native Google Sign-In (SDK Google, tanpa browser):
    //   - bottom sheet pilih akun Google (ID token audience = WEB client ID, diterima Supabase)
    //   - Play Services memvalidasi identitas app via Android OAuth client di Google Cloud
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === "cancelled") return "Login dibatalkan";

      const idToken = response.data.idToken;
      if (!idToken) return "Tidak ada ID token dari Google";

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (error) return error.message;

      await refreshProfile();
      return null;
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) {
        return "Login sedang berlangsung";
      }
      if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return "Google Play Services tidak tersedia di perangkat ini";
      }
      return "Gagal login Google";
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    try {
      await GoogleSignin.signOut();
    } catch {
      // abaikan — session Supabase sudah dihapus
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, user, name, role, hasProfile, hasSite, loading, signInWithGoogle, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
