import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabaseClient";
import { authApi } from "@/utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const configured = isSupabaseBrowserConfigured();
  const [loading, setLoading] = useState(configured);
  const supabase = useMemo(() => (configured ? getSupabaseBrowserClient() : null), [configured]);

  const refreshProfile = useCallback(async () => {
    if (!configured) return null;
    const client = await authApi();
    const { data } = await client.get("/api/auth/me");
    setProfile(data.profile);
    return data.profile;
  }, [configured]);

  useEffect(() => {
    if (!configured || !supabase) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      setSession(data.session);

      if (data.session) {
        try {
          await refreshProfile();
        } catch {
          setProfile(null);
        }
      }

      setLoading(false);
    }

    bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        try {
          await refreshProfile();
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [configured, refreshProfile, supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, [supabase]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      loading,
      configured,
      refreshProfile,
      signOut,
      supabase
    }),
    [configured, loading, profile, refreshProfile, session, signOut, supabase]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
