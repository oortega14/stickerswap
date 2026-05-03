import React, { createContext, useContext } from "react";
import { lightTheme, type Theme } from "./themes";

type Mode = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  mode: Mode;
  setMode: (m: Mode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // F1: forzamos light. F2 agrega AsyncStorage + darkTheme.
  const value: ThemeContextValue = {
    theme: lightTheme,
    mode: "light",
    setMode: async () => {
      // no-op en F1 — toggle se implementa en F2
    }
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
