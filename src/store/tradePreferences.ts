import { create } from "zustand";

interface TradePrefsState {
  groupBySection: boolean;
  setGroupBySection: (v: boolean) => void;
}

export const useTradePrefs = create<TradePrefsState>((set) => ({
  groupBySection: true,
  setGroupBySection: (groupBySection) => set({ groupBySection })
}));
