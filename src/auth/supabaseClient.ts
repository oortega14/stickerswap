import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY (check your .env)"
  );
}

// SecureStore tiene un límite duro de 2KB por item en iOS. Las JWT de Supabase
// se pasan ese tamaño fácil. Para no romper, partimos el valor en chunks y los
// guardamos bajo `key.0`, `key.1`, etc, con un meta `key.chunks` con el conteo.
const CHUNK_SIZE = 1800;

async function safeGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.warn("SecureStore.setItemAsync failed for", key, e);
  }
}

async function safeDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

async function clearChunks(key: string): Promise<void> {
  const countStr = await safeGet(`${key}.chunks`);
  if (countStr) {
    const count = parseInt(countStr, 10);
    for (let i = 0; i < count; i++) {
      await safeDelete(`${key}.${i}`);
    }
    await safeDelete(`${key}.chunks`);
  }
}

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const direct = await safeGet(key);
    if (direct !== null) return direct;
    const countStr = await safeGet(`${key}.chunks`);
    if (!countStr) return null;
    const count = parseInt(countStr, 10);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await safeGet(`${key}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join("");
  },

  setItem: async (key: string, value: string): Promise<void> => {
    // Limpiar tanto la versión simple como la chunked previa
    await safeDelete(key);
    await clearChunks(key);

    if (value.length <= CHUNK_SIZE) {
      await safeSet(key, value);
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      await safeSet(
        `${key}.${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }
    await safeSet(`${key}.chunks`, String(chunks));
  },

  removeItem: async (key: string): Promise<void> => {
    await safeDelete(key);
    await clearChunks(key);
  }
};

export const supabase = createClient(url, anon, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
