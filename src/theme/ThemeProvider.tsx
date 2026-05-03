import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightTheme, darkTheme, type Theme } from "./themes";

export type Mode = "light" | "dark";

const STORAGE_KEY = "panini.theme.mode";

type ThemeContextValue = {
  theme: Theme;
  mode: Mode;
  setMode: (m: Mode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");

  // Hidratar la preferencia desde AsyncStorage al boot (una sola vez).
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "dark" || stored === "light") {
          setModeState(stored);
        }
      })
      .catch(() => {
        // Si AsyncStorage falla (módulo no enlazado, etc.), seguimos con default light.
      });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: mode === "dark" ? darkTheme : lightTheme,
      mode,
      setMode: async (m) => {
        setModeState(m);
        try {
          await AsyncStorage.setItem(STORAGE_KEY, m);
        } catch {
          // El estado en memoria ya cambió; si falla la persistencia, el toggle
          // funciona en sesión y se pierde al reiniciar. Aceptable.
        }
      }
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
