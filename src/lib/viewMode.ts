import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ViewMode = "grid" | "list";

const KEYS = {
  home: "panini.view.home",
  team: "panini.view.team"
} as const;

export type ViewScope = keyof typeof KEYS;

/**
 * Modo de visualización persistido por scope. Carga el valor guardado al
 * mount; mientras tanto devuelve el `fallback`. Las escrituras son fire-and-
 * forget: si AsyncStorage falla, el cambio queda en memoria pero se pierde al
 * reiniciar.
 */
export function useViewMode(
  scope: ViewScope,
  fallback: ViewMode = "grid"
): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(fallback);

  useEffect(() => {
    AsyncStorage.getItem(KEYS[scope])
      .then((v) => {
        if (v === "grid" || v === "list") setMode(v);
      })
      .catch(() => {});
  }, [scope]);

  const update = useCallback(
    (m: ViewMode) => {
      setMode(m);
      AsyncStorage.setItem(KEYS[scope], m).catch(() => {});
    },
    [scope]
  );

  return [mode, update];
}
