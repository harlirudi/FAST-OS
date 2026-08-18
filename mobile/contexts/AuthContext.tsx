import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

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

    return () => listener.subscription.unsubscribe();
  }, [refreshProfile]);

  const signInWithGoogle = async () => {
    const redirectUri = makeRedirectUri({
      scheme: "facilityos",
      path: "auth/callback",
    });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });
    if (error) return error.message;
    if (!data?.url) return "Tidak ada URL login Google";

    // Buka browser untuk login Google, lalu kembali ke app
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    if (result.type === "success") {
      await refreshProfile();
      return null;
    }
    return result.type === "cancel" ? "Login dibatalkan" : "Gagal login Google";
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
