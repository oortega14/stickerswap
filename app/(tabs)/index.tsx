import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { ProgressBar } from "@/ui/ProgressBar";
import { Skeleton } from "@/ui/Skeleton";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { useProgress } from "@/hooks/useProgress";
import { usePendingCount } from "@/hooks/usePendingCount";
import { progressColor } from "@/theme/progress";
import { useTheme } from "@/theme/ThemeProvider";
import { getTeamColors } from "@/theme/teamColors";
import { getTeamFlag } from "@/theme/teamFlags";
import { useViewMode } from "@/lib/viewMode";
import { ViewToggle } from "@/ui/ViewToggle";
import type { SectionProgress } from "@/domain/types";

type Sort = "album" | "most" | "least";

export default function Home() {
  const { data, isLoading } = useProgress();
  const { data: pending } = usePendingCount();
  const { theme, mode, setMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("album");
  const [view, setView] = useViewMode("home", "grid");

  const sections = useMemo(() => {
    if (!data) return [];
    let list = [...data.bySection];
    if (query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      list = list.filter((s) => s.section.toLowerCase().includes(q));
    }
    if (sort === "album") {
      // Equipos en orden de álbum (ya vienen ordenados desde computeProgress);
      // especiales (Intro/Extras/Coca-Cola) al final para que la grilla arranque con equipos.
      const teams = list.filter((s) => s.teamCode);
      const specials = list.filter((s) => !s.teamCode);
      return [...teams, ...specials];
    }
    if (sort === "most") return list.sort((a, b) => b.pct - a.pct);
    return list.sort((a, b) => a.pct - b.pct);
  }, [data, query, sort]);

  return (
    <ThemedBackground>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1 pr-3">
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>Mi Álbum</Text>
            {data && (
              <Text style={{ color: theme.textMute, fontSize: 13, marginTop: 2 }}>
                {data.collected} / {data.total} láminas · {data.duplicates} repes
                {pending && pending > 0 ? ` · ${pending} pend.` : ""}
              </Text>
            )}
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push("/(tabs)/trades" as never)}
              accessibilityRole="button"
              accessibilityLabel="Intercambios"
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.border
              }}
            >
              <Text style={{ color: theme.text, fontSize: 13, marginRight: 6 }}>⇄</Text>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}>Intercambios</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode(mode === "dark" ? "light" : "dark")}
              accessibilityRole="button"
              accessibilityLabel="Cambiar tema"
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
              <Text style={{ color: theme.text, fontSize: 16 }}>{mode === "dark" ? "☾" : "☀"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Overall progress (línea fina) */}
        {data && (
          <View className="mb-4">
            <ProgressBar
              pct={data.pct}
              height={3}
              from={progressColor(data.pct, theme)}
              to={progressColor(data.pct, theme)}
            />
          </View>
        )}

        {/* Search + view toggle */}
        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar equipo o sección…"
            placeholderTextColor={theme.textMute}
            autoCorrect={false}
            accessibilityLabel="Buscar equipo"
            style={{
              flex: 1,
              backgroundColor: theme.card,
              color: theme.text,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14
            }}
          />
          <ViewToggle mode={view} onChange={setView} />
        </View>

        {/* Sort */}
        <View className="mb-3">
          <SegmentedControl<Sort>
            options={[
              { value: "album", label: "Álbum" },
              { value: "most", label: "Más pegados" },
              { value: "least", label: "Menos pegados" }
            ]}
            value={sort}
            onChange={setSort}
          />
        </View>

        {/* Grid o lista según view */}
        {isLoading || !data ? (
          view === "grid" ? (
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={{ width: "33.333%", padding: 4 }}>
                  <Skeleton style={{ height: 110 }} />
                </View>
              ))}
            </View>
          ) : (
            <View>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} style={{ height: 56, marginBottom: 8 }} />
              ))}
            </View>
          )
        ) : sections.length === 0 ? (
          <Text style={{ color: theme.textMute, textAlign: "center", marginTop: 16 }}>
            Sin resultados.
          </Text>
        ) : view === "grid" ? (
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
            {sections.map((s) => (
              <CountryCard
                key={s.section}
                s={s}
                onPress={() => {
                  const id = s.teamCode ?? s.section;
                  router.push(`/album/${encodeURIComponent(id)}` as never);
                }}
              />
            ))}
          </View>
        ) : (
          <View>
            {sections.map((s) => (
              <CountryRow
                key={s.section}
                s={s}
                onPress={() => {
                  const id = s.teamCode ?? s.section;
                  router.push(`/album/${encodeURIComponent(id)}` as never);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedBackground>
  );
}

function CountryRow({ s, onPress }: { s: SectionProgress; onPress: () => void }) {
  const { theme } = useTheme();
  const teamColors = s.teamCode ? getTeamColors(s.teamCode) : null;
  const flag = s.teamCode ? getTeamFlag(s.teamCode) : "✦";
  const interactive = true;
  const Wrapper = interactive ? Pressable : View;
  const bandColor = teamColors?.bg ?? theme.accent;

  return (
    <Wrapper
      onPress={interactive ? onPress : undefined}
      accessibilityRole={interactive ? "button" : undefined}
      accessibilityLabel={interactive ? `Abrir ${s.section}` : undefined}
      style={{
        flexDirection: "row",
        marginBottom: 8,
        borderRadius: 10,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: "hidden",
        shadowColor: theme.text,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1
      }}
    >
      <View style={{ width: 5, backgroundColor: bandColor }} />
      <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 pr-2">
            <Text style={{ fontSize: 20, marginRight: 8 }}>{flag}</Text>
            <Text
              style={{ color: theme.text, fontSize: 15, fontWeight: "700", flex: 1 }}
              numberOfLines={1}
            >
              {s.section}
            </Text>
          </View>
          <Text style={{ color: theme.textMute, fontSize: 12 }}>
            {s.collected}/{s.total}
            {interactive ? "  ›" : ""}
          </Text>
        </View>
        <View style={{ marginTop: 6 }}>
          <ProgressBar pct={s.pct} height={2} from={bandColor} to={bandColor} />
        </View>
      </View>
    </Wrapper>
  );
}

function CountryCard({ s, onPress }: { s: SectionProgress; onPress: () => void }) {
  const { theme } = useTheme();
  const teamColors = s.teamCode ? getTeamColors(s.teamCode) : null;
  const flag = s.teamCode ? getTeamFlag(s.teamCode) : "✦";
  const interactive = true;
  const Wrapper = interactive ? Pressable : View;

  // Banda superior: para equipos usamos su color primario; para especiales,
  // un acento neutro del theme (café medio).
  const bandColor = teamColors?.bg ?? theme.accent;

  return (
    <View style={{ width: "33.333%", padding: 4 }}>
      <Wrapper
        onPress={interactive ? onPress : undefined}
        accessibilityRole={interactive ? "button" : undefined}
        accessibilityLabel={interactive ? `Abrir ${s.section}` : undefined}
        style={{
          borderRadius: 12,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
          shadowColor: theme.text,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1
        }}
      >
        <View style={{ height: 4, backgroundColor: bandColor }} />
        <View style={{ padding: 10 }}>
          <Text style={{ fontSize: 22, marginBottom: 4 }}>{flag}</Text>
          <Text
            style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}
            numberOfLines={1}
          >
            {s.section}
          </Text>
          <Text style={{ color: theme.textMute, fontSize: 11, marginTop: 2, marginBottom: 8 }}>
            {s.collected}/{s.total}
          </Text>
          <ProgressBar
            pct={s.pct}
            height={2}
            from={bandColor}
            to={bandColor}
          />
        </View>
      </Wrapper>
    </View>
  );
}
