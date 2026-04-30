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
    .single();
  if (error) {
    console.warn("fetchProfile error", error.message);
    return null;
  }
  return data as ProfileUser;
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

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setSession(session);
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
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
