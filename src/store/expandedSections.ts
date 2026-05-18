import { create } from "zustand";

interface Store {
  expanded: Set<string>;
  toggle: (sectionId: string) => void;
  isExpanded: (sectionId: string) => boolean;
  collapseAll: () => void;
}

export const useExpandedSections = create<Store>((set, get) => ({
  expanded: new Set<string>(),
  toggle: (sectionId) => {
    const next = new Set(get().expanded);
    if (next.has(sectionId)) next.delete(sectionId);
    else next.add(sectionId);
    set({ expanded: next });
  },
  isExpanded: (sectionId) => get().expanded.has(sectionId),
  collapseAll: () => set({ expanded: new Set<string>() }),
}));
