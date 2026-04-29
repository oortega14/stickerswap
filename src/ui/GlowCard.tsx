import React from "react";
import { View, ViewProps } from "react-native";

export function GlowCard({ children, className, style, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      {...rest}
      className={`rounded-xl border border-space-purple/30 bg-space-dark/70 p-4 ${className ?? ""}`}
      style={[
        {
          shadowColor: "#7c5cff",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 6
        },
        style
      ]}
    >
      {children}
    </View>
  );
}
