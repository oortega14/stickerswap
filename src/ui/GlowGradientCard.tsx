import React from "react";
import { View, ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function GlowGradientCard({
  children,
  className,
  style,
  ...rest
}: ViewProps & { className?: string }) {
  return (
    <View
      style={[
        {
          shadowColor: "#3a2e1a",
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
        colors={["#6b4423", "#8b6f47"]}
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
