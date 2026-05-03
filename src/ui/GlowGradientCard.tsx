import React from "react";
import { View, ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeProvider";

export function GlowGradientCard({
  children,
  className,
  style,
  ...rest
}: ViewProps & { className?: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          shadowColor: theme.text,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
          elevation: 3,
          borderRadius: 16
        },
        style
      ]}
    >
      <LinearGradient
        colors={[theme.accent, theme.textMute]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 16, padding: 1 }}
      >
        <View
          {...rest}
          className={`bg-space-dark rounded-[15px] p-4 ${className ?? ""}`}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}
