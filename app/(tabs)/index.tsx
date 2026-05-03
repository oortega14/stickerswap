import { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedScrollHandler } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { ProgressBar } from "@/ui/ProgressBar";
import { Skeleton } from "@/ui/Skeleton";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { useProgress } from "@/hooks/useProgress";
import { usePendingCount } from "@/hooks/usePendingCount";
import { colors } from "@/theme/colors";
import { progressColor } from "@/theme/progress";
import { useTheme } from "@/theme/ThemeProvider";
import type { SectionProgress } from "@/domain/types";

type Sort = "alpha" | "most" | "least";

export default function Home() {
  const { data, isLoading } = useProgress();
  const { data: pending } = usePendingCount();
  const { theme } = useTheme();
  const router = useRouter();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    }
  });

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("alpha");

  const sections = useMemo(() => {
    if (!data) return [];
    let list = [...data.bySection];
    if (query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      list = list.filter((s) => s.section.toLowerCase().includes(q));
    }
    if (sort === "alpha") list.sort((a, b) => a.section.localeCompare(b.section));
    else if (sort === "most") list.sort((a, b) => b.pct - a.pct);
    else if (sort === "least") list.sort((a, b) => a.pct - b.pct);
    return list;
  }, [data, query, sort]);

  return (
    <ThemedBackground>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        className="flex-1 px-4 pt-14"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-space-violet font-bold tracking-widest text-sm">MUNDIAL 2026</Text>
          {pending && pending > 0 ? (
            <Text className="text-space-mute text-xs">{pending} pendientes ⤴</Text>
          ) : null}
        </View>

        {isLoading || !data ? (
          <View>
            <Skeleton style={{ height: 120, marginBottom: 12 }} />
            <Skeleton style={{ height: 60, marginBottom: 8 }} />
            <Skeleton style={{ height: 60 }} />
          </View>
        ) : (
          <>
            <GlowCard className="mb-4">
              <Text className="text-space-mute text-xs tracking-widest mb-1">PROGRESO</Text>
              <Text className="text-space-ink text-3xl font-extrabold mb-2">
                {data.collected} / {data.total}
              </Text>
              <ProgressBar
                pct={data.pct}
                from={progressColor(data.pct, theme)}
                to={progressColor(data.pct, theme)}
              />
              <Text className="text-space-mute text-xs mt-2">
                {data.duplicates > 0 ? `${data.duplicates} repetidas` : "Sin repetidas"}
              </Text>
            </GlowCard>

            <View className="mb-3">
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar equipo o sección…"
                placeholderTextColor={colors.dim}
                className="bg-space-dark text-space-ink rounded-lg px-3 py-2"
                autoCorrect={false}
                accessibilityLabel="Buscar equipo"
              />
            </View>

            <View className="mb-3">
              <SegmentedControl<Sort>
                options={[
                  { value: "alpha", label: "A-Z" },
                  { value: "most", label: "Más" },
                  { value: "least", label: "Menos" }
                ]}
                value={sort}
                onChange={setSort}
              />
            </View>

            <Text className="text-space-mute text-xs tracking-widest mb-2">POR SECCIÓN</Text>
            {sections.length === 0 ? (
              <Text className="text-space-mute text-center mt-4">Sin resultados.</Text>
            ) : (
              sections.map((s) => (
                <SectionRow
                  key={s.section}
                  s={s}
                  onPress={() => {
                    if (s.teamCode) router.push(`/team/${s.teamCode}` as never);
                  }}
                />
              ))
            )}
          </>
        )}
      </Animated.ScrollView>
    </ThemedBackground>
  );
}

function SectionRow({ s, onPress }: { s: SectionProgress; onPress: () => void }) {
  const { theme } = useTheme();
  const interactive = !!s.teamCode;
  const Wrapper = interactive ? Pressable : View;
  return (
    <Wrapper
      onPress={interactive ? onPress : undefined}
      accessibilityLabel={interactive ? `Abrir equipo ${s.section}` : undefined}
      accessibilityRole={interactive ? "button" : undefined}
    >
      <GlowCard className="mb-2">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-space-ink font-semibold">{s.section}</Text>
          <Text className="text-space-mute text-xs">
            {s.collected}/{s.total}
            {interactive ? " ›" : ""}
          </Text>
        </View>
        <ProgressBar
          pct={s.pct}
          height={4}
          from={progressColor(s.pct, theme)}
          to={progressColor(s.pct, theme)}
        />
      </GlowCard>
    </Wrapper>
  );
}
