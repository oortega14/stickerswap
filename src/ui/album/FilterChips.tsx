import React from "react";
import { View, Pressable, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { FilterMode } from "@/domain/stickerFilter";

interface Props {
  counts: { all: number; missing: number; dup: number };
  active: FilterMode;
  onChange: (mode: FilterMode) => void;
}

export function FilterChips({ counts, active, onChange }: Props) {
  const { theme } = useTheme();

  const chips: { mode: FilterMode; label: string; count: number }[] = [
    { mode: "all",     label: "Todos",  count: counts.all },
    { mode: "missing", label: "Faltan", count: counts.missing },
    { mode: "dup",     label: "Repes",  count: counts.dup }
  ];

  return (
    <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
      {chips.map((c) => {
        const isActive = c.mode === active;
        return (
          <Pressable
            key={c.mode}
            onPress={() => onChange(c.mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${c.label}, ${c.count} cromos`}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: isActive ? theme.text : theme.card,
              borderWidth: 1,
              borderColor: isActive ? theme.text : theme.border
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: isActive ? theme.bg : theme.textMute
              }}
            >
              {c.label} · {c.count}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
