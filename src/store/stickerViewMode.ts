import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type StickerViewMode = "compact" | "full";

interface Store {
  mode: StickerViewMode;
  setMode: (m: StickerViewMode) => void;
}

export const useStickerViewMode = create<Store>()(
  persist(
    (set) => ({
      mode: "compact",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "panini.album.viewMode",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
