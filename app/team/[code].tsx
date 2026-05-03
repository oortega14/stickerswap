import { useMemo } from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ProgressBar } from "@/ui/ProgressBar";
import { useTeamStickers, useIncrement, useDecrement } from "@/hooks/useStickers";
import { haptics } from "@/lib/haptics";
import { getTeamColors, type TeamColors } from "@/theme/teamColors";
import { getTeamFlag } from "@/theme/teamFlags";
import { useTheme } from "@/theme/ThemeProvider";
import { withAlpha } from "@/theme/colors";
import { useViewMode } from "@/lib/viewMode";
import { ViewToggle } from "@/ui/ViewToggle";
import type { StickerWithStatus } from "@/domain/types";

// Elige el color más representativo de la bandera para tintar el fondo;
// evita blancos y negros porque tintarlos no comunica identidad.
function pickTint(c: TeamColors): string {
  const isNeutral = (h: string) => /^#(fff|ffffff|000|000000)$/i.test(h);
  if (!isNeutral(c.bg)) return c.bg;
  if (!isNeutral(c.surface)) return c.surface;
  return c.accent;
}

export default function TeamDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { theme, mode } = useTheme();
  const { data, isLoading } = useTeamStickers(code ?? "");
  const inc = useIncrement();
  const dec = useDecrement();

  const teamColors = useMemo(() => getTeamColors(code), [code]);
  const tint = useMemo(() => pickTint(teamColors), [teamColors]);
  const tintAlpha = mode === "dark" ? 0.22 : 0.14;
  const [view, setView] = useViewMode("team", "grid");

  const summary = useMemo(() => {
    if (!data) return null;
    const total = data.length;
    const collected = data.filter((s) => s.count >= 1).length;
    const duplicates = data.reduce((acc, s) => acc + (s.count > 1 ? s.count - 1 : 0), 0);
    return { total, collected, duplicates, pct: total === 0 ? 0 : collected / total };
  }, [data]);

  if (isLoading || !data || !summary) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const teamName = data[0]?.section ?? code ?? "";
  const sorted = [...data].sort((a, b) => a.number - b.number);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Tint sutil del color del equipo, gradient arriba → fade abajo */}
      <LinearGradient
        colors={[withAlpha(tint, tintAlpha), withAlpha(tint, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 360,
          pointerEvents: "none"
        }}
      />

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
            <ViewToggle mode={view} onChange={setView} />
          </View>

          <View className="flex-row items-center mb-1">
            <Text style={{ fontSize: 32, marginRight: 10 }}>{getTeamFlag(code)}</Text>
            <View className="flex-1">
              <Text style={{ color: theme.text, fontSize: 26, fontWeight: "800" }}>{teamName}</Text>
              <Text style={{ color: theme.textMute, fontSize: 12, marginTop: 2 }}>
                {summary.collected}/{summary.total} ·{" "}
                {summary.duplicates > 0 ? `${summary.duplicates} repes` : "0 repes"}
              </Text>
            </View>
          </View>

          {/* Progress fino con el color del equipo como acento */}
          <View className="mt-4">
            <ProgressBar pct={summary.pct} height={3} from={tint} to={tint} />
          </View>
        </View>

        {/* Grid o lista según view */}
        {view === "grid" ? (
          <View className="flex-row flex-wrap" style={{ paddingHorizontal: 12 }}>
            {sorted.map((s) => (
              <StickerCard
                key={s.code}
                s={s}
                accent={tint}
                onTap={() => {
                  haptics.light();
                  inc.mutate(s.code);
                }}
                onLong={() => {
                  haptics.medium();
                  dec.mutate(s.code);
                }}
              />
            ))}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {sorted.map((s) => (
              <StickerRow
                key={s.code}
                s={s}
                accent={tint}
                onTap={() => {
                  haptics.light();
                  inc.mutate(s.code);
                }}
                onLong={() => {
                  haptics.medium();
                  dec.mutate(s.code);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StickerRow({
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

  return (
    <Pressable
      onPress={onTap}
      onLongPress={onLong}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${collected ? "Pegado" : "Falta"}: ${s.name}. Tocá para sumar, mantené para restar.`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
        borderRadius: 10,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: collected ? withAlpha(accent, 0.5) : theme.border,
        overflow: "hidden"
      }}
    >
      <View style={{ width: 5, alignSelf: "stretch", backgroundColor: collected ? accent : "transparent" }} />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 }}>
        <Text
          style={{
            color: accent,
            fontSize: 11,
            fontWeight: "700",
            minWidth: 70
          }}
        >
          #{s.code}
        </Text>
        <Text
          style={{ color: theme.text, fontSize: 14, fontWeight: "600", flex: 1, marginRight: 8 }}
          numberOfLines={1}
        >
          {s.name}
        </Text>
        {collected ? (
          <View
            style={{
              minWidth: 26,
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
        ) : (
          <Text style={{ color: theme.textMute, fontSize: 14, opacity: 0.5 }}>·</Text>
        )}
      </View>
    </Pressable>
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

  return (
    <View style={{ width: "33.333%", padding: 4 }}>
      <Pressable
        onPress={onTap}
        onLongPress={onLong}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${collected ? "Pegado" : "Falta"}: ${s.name}. Tocá para sumar, mantené para restar.`}
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
        {/* Placeholder visual: shield (jugadores/escudo) o grid (foto plantel) */}
        <View
          style={{
            aspectRatio: 1,
            backgroundColor: collected ? withAlpha(accent, 0.12) : theme.bg,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ fontSize: 36, color: withAlpha(theme.textMute, 0.5) }}>
            {s.type === "team_photo" ? "▦" : "⛊"}
          </Text>
          {/* Badge esquina: ✓ si pegado, ×N si repetido */}
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
          <Text style={{ color: accent, fontSize: 11, fontWeight: "700" }}>
            #{s.code}
          </Text>
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
