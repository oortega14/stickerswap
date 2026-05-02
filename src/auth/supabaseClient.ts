import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY (check your .env)"
  );
}

// DIAGNÓSTICO: storage in-memory mientras descartamos el problema con SecureStore.
// La sesión NO persiste entre arrancadas — hay que loguearse en cada apertura.
// TODO: migrar a AsyncStorage cuando confirmemos que SecureStore era el problema.
const memStore = new Map<string, string>();
const MemoryAdapter = {
  getItem: async (key: string) => memStore.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memStore.set(key, value);
  },
  removeItem: async (key: string) => {
    memStore.delete(key);
  }
};

export const supabase = createClient(url, anon, {
  auth: {
    storage: MemoryAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
