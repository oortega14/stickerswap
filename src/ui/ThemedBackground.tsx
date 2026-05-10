import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Fondo coloreado por theme.
 *
 * Incluye un overlay sólido del color del theme sobre la safe-area top
 * (`statusBarBackdrop`, default true) que tapa contenido en scroll para
 * que no se mezcle con los iconos del status bar de iOS. Las pantallas
 * que necesiten contenido visible bajo el status bar (ej. cámara) lo
 * pueden desactivar con la prop `statusBarBackdrop={false}`.
 */
export function ThemedBackground({
  children,
  statusBarBackdrop = true
}: {
  children?: React.ReactNode;
  statusBarBackdrop?: boolean;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {children}
      {statusBarBackdrop && insets.top > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: theme.bg,
            zIndex: 10
          }}
        />
      )}
    </View>
  );
}
