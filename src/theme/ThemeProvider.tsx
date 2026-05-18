import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { vars } from "nativewind";
import { lightTheme, darkTheme, type Theme } from "./themes";

export type Mode = "light" | "dark";

const STORAGE_KEY = "panini.theme.mode";

type ThemeContextValue = {
  theme: Theme;
  mode: Mode;
  setMode: (m: Mode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Variables RGB (sin prefijo) consumidas por NativeWind via clases space-*.
// Remapeadas a Tailwind slate. Los nombres son legacy.
const lightSpaceVars = vars({
  "--space-black": "0 0 0",
  "--space-deep": "241 245 249",   // slate-100 (bg)
  "--space-dark": "255 255 255",   // white (card)
  "--space-mid": "226 232 240",    // slate-200
  "--space-purple": "51 65 85",    // slate-700 (accent)
  "--space-violet": "100 116 139", // slate-500
  "--space-blue": "220 38 38",     // rojo progress
  "--space-sky": "22 163 74",      // verde progress
  "--space-ink": "15 23 42",       // slate-900 (texto)
  "--space-mute": "100 116 139",   // slate-500
  "--space-dim": "148 163 184"     // slate-400
});

const darkSpaceVars = vars({
  "--space-black": "0 0 0",
  "--space-deep": "30 41 59",      // slate-800 (bg)
  "--space-dark": "51 65 85",      // slate-700 (card)
  "--space-mid": "71 85 105",      // slate-600
  "--space-purple": "203 213 225", // slate-300 (accent)
  "--space-violet": "148 163 184", // slate-400
  "--space-blue": "239 68 68",
  "--space-sky": "34 197 94",
  "--space-ink": "241 245 249",    // slate-100 (texto)
  "--space-mute": "148 163 184",   // slate-400
  "--space-dim": "100 116 139"     // slate-500
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "dark" || stored === "light") {
          setModeState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: mode === "dark" ? darkTheme : lightTheme,
      mode,
      setMode: async (m) => {
        setModeState(m);
        try {
          await AsyncStorage.setItem(STORAGE_KEY, m);
        } catch {}
      }
    }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, mode === "dark" ? darkSpaceVars : lightSpaceVars]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
