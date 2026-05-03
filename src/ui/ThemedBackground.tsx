import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Fondo coloreado por theme. Reemplaza al StarryBackground original.
 * Acepta `children` y se expande con flex: 1 para llenar la pantalla.
 */
export function ThemedBackground({ children }: { children?: React.ReactNode }) {
  const { theme } = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.bg }}>{children}</View>;
}
