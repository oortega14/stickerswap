import React from "react";
import { View, Pressable, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { StickerViewMode } from "@/store/stickerViewMode";

interface Props {
  mode: StickerViewMode;
  onChange: (m: StickerViewMode) => void;
}

const OPTIONS: { value: StickerViewMode; label: string }[] = [
  { value: "compact", label: "● Compacto" },
  { value: "full",    label: "▦ Completo" }
];

export function ViewModeToggle({ mode, onChange }: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: theme.card,
        borderRadius: 10,
        padding: 3,
        marginVertical: 12
      }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === mode;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: active ? theme.card : "transparent",
              alignItems: "center"
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: active ? theme.text : theme.textMute
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
