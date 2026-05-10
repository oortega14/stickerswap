// Página de sección no-equipo: Intro, Extras, Coca-Cola.
// Versión simplificada del team page — sin bulk-mark, sin gradient de
// colores de equipo, sin destildar mode. Solo grid 3-col con cards
// tappables (tap = incrementar, long-press = decrementar) y header
// con back + progreso.

import { useMemo } from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ProgressBar } from "@/ui/ProgressBar";
import { useSectionStickers, useIncrement, useDecrement } from "@/hooks/useStickers";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme/ThemeProvider";
import { withAlpha } from "@/theme/colors";
import type { StickerWithStatus } from "@/domain/types";
import { StickerCardVisual } from "@/ui/StickerCardVisual";

export default function SectionDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const decodedName = decodeURIComponent(name ?? "");
  const { data, isLoading } = useSectionStickers(decodedName);
  const inc = useIncrement();
  const dec = useDecrement();

  const summary = useMemo(() => {
    if (!data) return null;
    const total = data.length;
    const collected = data.filter((s) => s.count >= 1).length;
    return { total, collected, pct: total === 0 ? 0 : collected / total };
  }, [data]);

  if (isLoading || !data || !summary) {
    return (
      <View
        style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const sorted = [...data].sort((a, b) => a.number - b.number);

  const handleTap = (stickerCode: string) => {
    haptics.light();
    inc.mutate(stickerCode);
  };
  const handleLong = (stickerCode: string) => {
    haptics.medium();
    dec.mutate(stickerCode);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View style={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16 }}>
          <View className="flex-row items-center justify-between mb-4">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Volver"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.border,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>‹</Text>
            </Pressable>
          </View>

          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800", marginBottom: 4 }}>
            {decodedName}
          </Text>
          <Text style={{ color: theme.textMute, fontSize: 13, marginBottom: 12 }}>
            {summary.collected} / {summary.total} pegadas
          </Text>
          <ProgressBar pct={summary.pct} height={6} from={theme.accent} to={theme.accent} />
        </View>

        {/* Grid */}
        <View style={{ paddingHorizontal: 12, flexDirection: "row", flexWrap: "wrap" }}>
          {sorted.map((s) => (
            <StickerCard
              key={s.code}
              s={s}
              accent={theme.accent}
              onTap={() => handleTap(s.code)}
              onLong={() => handleLong(s.code)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function StickerCard({
  s,
  accent,
  onTap,
  onLong
}: {
  s: StickerWithStatus;
  accent: string;
  onTap: () => void;
  onLong: () => void;
}) {
  const { theme } = useTheme();
  const collected = s.count >= 1;
  const cardBg = collected ? withAlpha(accent, 0.12) : theme.bg;

  return (
    <View style={{ width: "33.333%", padding: 4 }}>
      <Pressable
        onPress={onTap}
        onLongPress={onLong}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${collected ? "Pegado" : "Falta"}: ${s.name}. Toca para sumar, mantén para restar.`}
        style={{
          borderRadius: 12,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: collected ? withAlpha(accent, 0.5) : theme.border,
          overflow: "hidden",
          shadowColor: theme.text,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1
        }}
      >
        <View
          style={{
            aspectRatio: 1,
            backgroundColor: cardBg,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <View style={{ width: "78%", height: "78%" }}>
            <StickerCardVisual sticker={s} cardBgColor={cardBg} />
          </View>
          {collected && (
            <View
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: accent,
                paddingHorizontal: 6,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700" }}>
                {s.count > 1 ? `×${s.count}` : "✓"}
              </Text>
            </View>
          )}
        </View>

        <View style={{ padding: 8 }}>
          <Text style={{ color: accent, fontSize: 11, fontWeight: "700" }}>#{s.code}</Text>
          <Text
            style={{ color: theme.text, fontSize: 12, fontWeight: "600", marginTop: 2 }}
            numberOfLines={1}
          >
            {s.name}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
