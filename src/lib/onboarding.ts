import { useEffect } from "react";
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const KEY = "panini_onboarded_v1";

interface OnboardingState {
  // null = aún no leímos SecureStore
  seen: boolean | null;
  setSeen: (v: boolean) => void;
  hydrate: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  seen: null,
  setSeen: (seen) => set({ seen }),
  hydrate: async () => {
    try {
      const v = await SecureStore.getItemAsync(KEY);
      set({ seen: v === "1" });
    } catch {
      set({ seen: false });
    }
  }
}));

export async function markOnboardingSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, "1");
  } catch {
    // best effort — si Keychain falla, el usuario ve onboarding de nuevo
  }
  // Actualizar también el store reactivo para que el AuthGate sepa al toque.
  useOnboardingStore.getState().setSeen(true);
}

// Conveniencia: hook que devuelve el flag actual.
export function useOnboardingSeen(): boolean | null {
  return useOnboardingStore((s) => s.seen);
}

// Hidratá una sola vez al boot.
export function useHydrateOnboarding() {
  const hydrate = useOnboardingStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
}

/** @deprecated Usá useOnboardingSeen + markOnboardingSeen */
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    return v === "1";
  } catch {
    return false;
  }
}
