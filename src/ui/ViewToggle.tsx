import { Pressable, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { ViewMode } from "@/lib/viewMode";

export function ViewToggle({
  mode,
  onChange
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const { theme } = useTheme();
  const next: ViewMode = mode === "grid" ? "list" : "grid";
  const icon = mode === "grid" ? "▤" : "▦"; // muestra el icono del MODO ALTERNO
  return (
    <Pressable
      onPress={() => onChange(next)}
      accessibilityRole="button"
      accessibilityLabel={mode === "grid" ? "Cambiar a vista lista" : "Cambiar a vista cuadrícula"}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Text style={{ color: theme.text, fontSize: 16 }}>{icon}</Text>
    </Pressable>
  );
}
