import { create } from "zustand";

export type FilterMode = "all" | "missing" | "duplicates";

interface FiltersState {
  query: string;
  mode: FilterMode;
  setQuery: (q: string) => void;
  setMode: (m: FilterMode) => void;
}

export const useFilters = create<FiltersState>((set) => ({
  query: "",
  mode: "all",
  setQuery: (query) => set({ query }),
  setMode: (mode) => set({ mode })
}));
