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

async function fetchProfile(userId: string): Promise<ProfileUser | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, invite_code")
    .eq("id", userId)
    .maybeSingle();
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
    .select("id, username, display_name, avatar_url, invite_code")
    .single();
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

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[onAuthStateChange]", event, "hasSession:", !!session);
      setSession(session);
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        console.log("[onAuthStateChange] profile loaded:", !!profile);
        setProfile(profile);
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
