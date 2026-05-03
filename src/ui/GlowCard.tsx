import React from "react";
import { View, ViewProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export function GlowCard({ children, className, style, ...rest }: ViewProps & { className?: string }) {
  const { theme } = useTheme();
  return (
    <View
      {...rest}
      className={`rounded-xl bg-space-dark p-4 ${className ?? ""}`}
      style={[
        {
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: theme.text,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2
        },
        style
      ]}
    >
      {children}
    </View>
  );
}
