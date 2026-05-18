import { create } from "zustand";
import type { FilterMode } from "@/domain/stickerFilter";

interface Store {
  filters: Record<string, FilterMode>;
  setFilter: (sectionId: string, mode: FilterMode) => void;
  getFilter: (sectionId: string) => FilterMode;
}

export const useFilterMode = create<Store>((set, get) => ({
  filters: {},
  setFilter: (sectionId, mode) =>
    set((state) => ({ filters: { ...state.filters, [sectionId]: mode } })),
  getFilter: (sectionId) => get().filters[sectionId] ?? "all"
}));
