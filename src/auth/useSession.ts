import { useEffect } from "react";
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export interface ProfileUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  invite_code: string;
  onboarding_completed: boolean;
  country: string | null;
  city_slug: string | null;
  city_label: string | null;
  discoverable: boolean;
}

interface SessionState {
  session: Session | null;
  authUser: User | null;
  user: ProfileUser | null;
  isLoading: boolean;
  setSession: (s: Session | null) => void;
  setProfile: (p: ProfileUser | null) => void;
  setLoading: (b: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  authUser: null,
  user: null,
  isLoading: true,
  setSession: (session) => set({ session, authUser: session?.user ?? null }),
  setProfile: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading })
}));

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

async function fetchProfile(userId: string): Promise<ProfileUser | null> {
  console.log("[fetchProfile] start userId:", userId);

  // DIAGNÓSTICO: probamos fetch directo en paralelo al cliente JS para ver
  // si es el cliente o la red en general lo que cuelga.
  (async () => {
    try {
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token;
      console.log("[direct-fetch] starting; hasAccessToken:", !!accessToken);
      const t0 = Date.now();
      const res = await fetch(
        `${url}/rest/v1/profiles?id=eq.${userId}&select=id,username`,
        {
          headers: {
            apikey: anon,
            Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${anon}`,
            Accept: "application/json"
          }
        }
      );
      const ms = Date.now() - t0;
      const text = await res.text();
      console.log(`[direct-fetch] status=${res.status} took=${ms}ms body=${text.slice(0, 200)}`);
    } catch (e) {
      console.warn("[direct-fetch] threw:", (e as Error).message);
    }
  })();

  let data: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    invite_code: string;
    onboarding_completed: boolean;
    country: string | null;
    city_slug: string | null;
    city_label: string | null;
    discoverable: boolean;
  } | null = null;
  let error: { message: string; code?: string } | null = null;
  try {
    const result = await withTimeout(
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, invite_code, onboarding_completed, country, city_slug, city_label, discoverable")
        .eq("id", userId)
        .maybeSingle(),
      5000,
      "fetchProfile.select"
    );
    data = result.data as typeof data;
    error = result.error as typeof error;
  } catch (e) {
    console.warn("[fetchProfile] select threw:", (e as Error).message);
    error = { message: (e as Error).message };
  }
  console.log("[fetchProfile] select returned:", { hasData: !!data, error: error?.message });
  if (error) {
    console.warn("fetchProfile error", error.message);
    return null;
  }
  if (data) return data as ProfileUser;

  // Fallback: el trigger handle_new_user no se ejecutó (puede pasar con OAuth
  // si el contexto de la sesión no estaba listo). Creamos el profile manual.
  console.warn("fetchProfile: no profile row, creating fallback");
  const fallbackUsername = `user_${userId.slice(0, 4)}${userId.slice(-4)}`.toLowerCase();
  const fallbackInvite = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username: fallbackUsername,
      invite_code: fallbackInvite
    })
    .select("id, username, display_name, avatar_url, invite_code, onboarding_completed, country, city_slug, city_label, discoverable")
    .single();
  console.log("[fetchProfile] insert returned:", { hasData: !!created, error: insertError?.message, code: insertError?.code });
  if (insertError) {
    console.warn("fallback profile insert failed:", insertError.message);
    // FK violation a auth.users → el user fue borrado del servidor pero el
    // JWT sigue cacheado localmente. Sign-out fuerza al usuario a autenticarse
    // de nuevo y se crea un user fresh.
    if (insertError.code === "23503") {
      console.warn("auth user no longer exists in server, signing out");
      await supabase.auth.signOut();
    }
    return null;
  }
  console.log("[fetchProfile] fallback created OK");
  return created as ProfileUser;
}

export function SessionProvider() {
  const { setSession, setProfile, setLoading } = useSessionStore();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id);
        if (mounted) setProfile(profile);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[onAuthStateChange]", event, "hasSession:", !!session);
      setSession(session);
      // IMPORTANTE: las queries Supabase NO pueden correr en este callback.
      // El cliente toma un lock interno y cualquier `from(...).select(...)`
      // queda esperando ese lock → deadlock. Lo deferimos al next tick para
      // que el listener libere primero.
      // Ref: https://github.com/supabase/supabase-js/issues/...
      const userId = session?.user?.id;
      if (userId) {
        setTimeout(async () => {
          const profile = await fetchProfile(userId);
          console.log("[onAuthStateChange] profile loaded:", !!profile);
          setProfile(profile);
        }, 0);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [setSession, setProfile, setLoading]);

  return null;
}

export function useSession() {
  return useSessionStore();
}
