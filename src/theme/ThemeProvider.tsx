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

const lightSpaceVars = vars({
  "--space-black": "0 0 0",
  "--space-deep": "253 246 227",
  "--space-dark": "255 250 240",
  "--space-mid": "245 232 200",
  "--space-purple": "107 68 35",
  "--space-violet": "139 111 71",
  "--space-blue": "220 38 38",
  "--space-sky": "22 163 74",
  "--space-ink": "58 46 26",
  "--space-mute": "139 111 71",
  "--space-dim": "168 148 114"
});

const darkSpaceVars = vars({
  "--space-black": "0 0 0",
  "--space-deep": "42 31 18",
  "--space-dark": "61 45 28",
  "--space-mid": "77 58 37",
  "--space-purple": "212 184 150",
  "--space-violet": "200 166 122",
  "--space-blue": "239 68 68",
  "--space-sky": "34 197 94",
  "--space-ink": "253 246 227",
  "--space-mute": "200 166 122",
  "--space-dim": "156 136 106"
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
