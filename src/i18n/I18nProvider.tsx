import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { es, en, type StringKey } from "./strings";

export type Lang = "es" | "en";

const STORAGE_KEY = "panini.lang";

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: (key: StringKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const TABLES: Record<Lang, Record<StringKey, string>> = { es, en };

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "es" || v === "en") setLangState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang: async (l) => {
        setLangState(l);
        try {
          await AsyncStorage.setItem(STORAGE_KEY, l);
        } catch {}
      },
      t: (key) => TABLES[lang][key]
    }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
