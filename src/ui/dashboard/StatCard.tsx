import React from "react";
import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

interface Props {
  label: string;
  value: string;
  sub?: string;
  size?: "sm" | "md";
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function StatCard({ label, value, sub, size = "sm", onPress, accessibilityLabel }: Props) {
  const { theme } = useTheme();
  const Wrapper: any = onPress ? Pressable : View;
  const valueSize = size === "md" ? 26 : 20;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      style={{
        flex: 1,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        padding: 10
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: theme.textMute,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 4
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: valueSize,
          fontWeight: "800",
          color: theme.text,
          lineHeight: valueSize * 1.05
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      {sub && (
        <Text
          style={{ fontSize: 11, color: theme.textMute, marginTop: 2 }}
          numberOfLines={1}
        >
          {sub}
        </Text>
      )}
    </Wrapper>
  );
}
