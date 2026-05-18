import React from "react";
import { View, Text } from "react-native";
import { ProgressBar } from "@/ui/ProgressBar";
import { useTheme } from "@/theme/ThemeProvider";
import { progressColor } from "@/theme/progress";

interface Props {
  pct: number;
  collected: number;
  total: number;
}

export function DashboardHero({ pct, collected, total }: Props) {
  const { theme } = useTheme();
  const accent = progressColor(pct, theme);
  const pctLabel = `${Math.round(pct * 100)}%`;

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: theme.textMute,
          textTransform: "uppercase",
          letterSpacing: 0.5
        }}
      >
        Progreso del album
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 4 }}>
        <Text
          style={{
            fontSize: 38,
            fontWeight: "800",
            color: theme.text,
            lineHeight: 42
          }}
        >
          {pctLabel}
        </Text>
        <Text style={{ fontSize: 13, color: theme.textMute }}>
          {collected} / {total} laminas
        </Text>
      </View>
      <View style={{ marginTop: 10 }}>
        <ProgressBar pct={pct} height={6} from={accent} to={accent} />
      </View>
    </View>
  );
}
