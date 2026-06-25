import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "reception" | "allopathy" | "homeopathy" | "admin";

export type ClinicProfile = {
  id: string;
  clinic_id: string;
  full_name: string;
  email: string;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: ClinicProfile | null;
  role: Role | null;
  clinicName: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

async function loadProfileBundle(userId: string) {
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, clinic_id, full_name, email")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  let clinicName: string | null = null;
  if (profile?.clinic_id) {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", profile.clinic_id)
      .maybeSingle();
    clinicName = clinic?.name ?? null;
  }

  return {
    profile: (profile as ClinicProfile | null) ?? null,
    role: (roleRow?.role as Role | undefined) ?? null,
    clinicName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [clinicName, setClinicName] = useState<string | null>(null);

  const hydrate = useCallback(async (uid: string | null) => {
    if (!uid) {
      setProfile(null);
      setRole(null);
      setClinicName(null);
      return;
    }
    const bundle = await loadProfileBundle(uid);
    setProfile(bundle.profile);
    setRole(bundle.role);
    setClinicName(bundle.clinicName);
  }, []);

  useEffect(() => {
    // Listener first (sync), then initial session check.
    // Only re-hydrate the profile bundle on identity changes — NOT on every
    // TOKEN_REFRESHED tick (which fires ~hourly + on tab focus) or every
    // INITIAL_SESSION (every mount). Re-hydrating on those events spawns
    // refresh storms during polling and never changes profile data anyway.
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      setSession(s);
      if (
        evt === "SIGNED_IN" ||
        evt === "SIGNED_OUT" ||
        evt === "USER_UPDATED"
      ) {
        // Defer hydration so React updates flush first.
        setTimeout(() => {
          void hydrate(s?.user?.id ?? null);
        }, 0);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await hydrate(data.session?.user?.id ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [hydrate]);

  const refresh = useCallback(async () => {
    await hydrate(session?.user?.id ?? null);
  }, [hydrate, session?.user?.id]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      role,
      clinicName,
      refresh,
      signOut,
    }),
    [loading, session, profile, role, clinicName, refresh, signOut],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
