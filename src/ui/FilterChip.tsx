import React from "react";
import { Pressable, Text } from "react-native";

export function FilterChip({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Filtro: ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-full px-3 py-1.5 ${active ? "bg-space-purple" : "bg-space-mid"}`}
    >
      <Text className={`text-xs font-semibold ${active ? "text-white" : "text-space-mute"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
