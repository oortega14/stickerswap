import React from "react";
import { View, ViewProps } from "react-native";

export function GlowCard({ children, className, style, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      {...rest}
      className={`rounded-xl border border-space-purple/15 bg-space-dark p-4 ${className ?? ""}`}
      style={[
        {
          shadowColor: "#3a2e1a",
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
