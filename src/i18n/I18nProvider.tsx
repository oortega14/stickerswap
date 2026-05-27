import React, { createContext, useContext, useMemo } from "react";
import { es, type StringKey } from "./strings";

export type Lang = "es";

type I18nContextValue = {
  lang: Lang;
  t: (key: StringKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({
      lang: "es",
      t: (key) => es[key]
    }),
    []
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
