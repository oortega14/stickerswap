import { useState } from "react";
import { ScrollView, View, Text, Pressable, Switch, Share } from "react-native";
import { useRouter } from "expo-router";
import { haptics } from "@/lib/haptics";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { GlowGradientCard } from "@/ui/GlowGradientCard";
import { EmptyState } from "@/ui/EmptyState";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { ProgressBar } from "@/ui/ProgressBar";
import { useMyList } from "@/hooks/useMyList";
import { useMatches } from "@/hooks/useMatches";
import { useNearbyMatches } from "@/hooks/useNearbyMatches";
import { useTradePrefs } from "@/store/tradePreferences";
import { useSession } from "@/auth/useSession";
import { useTheme } from "@/theme/ThemeProvider";

type Tab = "matches" | "mine" | "nearby";

export default function Trades() {
  const [tab, setTab] = useState<Tab>("mine");
  const { data, text, isLoading } = useMyList();
  const { groupBySection, setGroupBySection } = useTradePrefs();
  const { theme } = useTheme();

  const onShare = async () => {
    if (!text) return;
    await haptics.success();
    await Share.share({ message: text, title: "Mi lista de cambios" });
  };

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">CAMBIOS</Text>

        <View className="mb-4">
          <SegmentedControl<Tab>
            options={[
              { value: "matches", label: "Matches" },
              { value: "mine", label: "Mi lista" },
              { value: "nearby", label: "Cerca de mí" }
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === "matches" ? (
          <MatchesView />
        ) : tab === "nearby" ? (
          <NearbyView />
        ) : isLoading || !data ? (
          <Text className="text-space-mute text-center mt-4">Cargando…</Text>
        ) : (
          <>
            <View className="flex-row gap-3 mb-3">
              <GlowCard className="flex-1">
                <Text className="text-space-mute text-xs">NECESITO</Text>
                <Text className="text-space-ink text-2xl font-bold">{data.needed.length}</Text>
              </GlowCard>
              <GlowCard className="flex-1">
                <Text className="text-space-mute text-xs">REPETIDAS</Text>
                <Text className="text-space-ink text-2xl font-bold">{data.duplicates.length}</Text>
              </GlowCard>
            </View>

            <GlowCard className="mb-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-space-ink text-sm">Agrupar por sección</Text>
                <Switch
                  value={groupBySection}
                  onValueChange={setGroupBySection}
                  trackColor={{ false: theme.textMute, true: theme.accent }}
                  thumbColor={theme.card}
                />
              </View>
            </GlowCard>

            <GlowCard className="mb-4">
              <Text className="text-space-mute text-xs mb-2 tracking-widest">VISTA PREVIA</Text>
              <Text className="text-space-ink text-xs" style={{ fontFamily: "Courier" }}>
                {text || "Sin contenido para compartir aún."}
              </Text>
            </GlowCard>

            <GlowGradientCard>
              <Pressable
                onPress={onShare}
                disabled={!text}
                className={`rounded-xl py-4 items-center ${text ? "" : "opacity-50"}`}
                accessibilityLabel="Compartir mi lista"
                accessibilityRole="button"
              >
                <Text className="text-white font-semibold">Compartir mi lista</Text>
              </Pressable>
            </GlowGradientCard>
          </>
        )}
      </ScrollView>
    </ThemedBackground>
  );
}

function MatchesView() {
  const router = useRouter();
  const { summary, isLoading } = useMatches();

  if (isLoading) return <Text className="text-space-mute text-center mt-4">Cargando…</Text>;
  if (summary.length === 0) {
    return <EmptyState variant="rocket" title="Sin matches todavía" message="Sumá amigos desde Perfil." />;
  }

  return (
    <>
      {summary.map((s) => (
        <Pressable
          key={s.friendId}
          onPress={() => router.push(`/friends/${s.username}` as never)}
          accessibilityLabel={`Ver matches con @${s.username}`}
          accessibilityRole="button"
        >
          <GlowCard className="mb-2">
            <Text className="text-space-ink font-semibold">@{s.username}</Text>
            <Text className="text-space-mute text-xs mt-1">
              {s.matchCount} {s.matchCount === 1 ? "que te falta" : "que te faltan"}
            </Text>
            <Text className="text-space-violet text-xs mt-1">
              {s.sample.join(" · ")}
              {s.matchCount > 3 ? " · …" : ""}
            </Text>
          </GlowCard>
        </Pressable>
      ))}
    </>
  );
}

function NearbyView() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSession();
  const { data, isLoading } = useNearbyMatches();

  if (!user?.discoverable) {
    return (
      <EmptyState
        variant="rocket"
        title="Activá la discoverabilidad"
        message="Andá a Perfil → Editar para activar 'Que me encuentren' y que personas de tu ciudad puedan contactarte."
      />
    );
  }
  if (isLoading) return <Text className="text-space-mute text-center mt-4">Cargando…</Text>;
  if (!data || data.length === 0) {
    return <EmptyState variant="rocket" title="Sin matches cerca todavía" message={`Nadie en ${user.city_label ?? "tu ciudad"} tiene complementarios con vos por ahora. Volvé después.`} />;
  }

  return (
    <>
      {data.map((m) => {
        const maxScore = data[0]?.score ?? m.score;
        const pct = maxScore > 0 ? m.score / maxScore : 0;
        return (
          <Pressable
            key={m.themId}
            onPress={() => router.push(`/nearby/${m.username}` as never)}
            accessibilityLabel={`Ver match con @${m.username}, score ${m.score}`}
            accessibilityRole="button"
          >
            <GlowCard className="mb-2">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-space-ink font-semibold">@{m.username}</Text>
                <Text style={{ color: theme.accent, fontWeight: "700" }}>score {m.score}</Text>
              </View>
              <Text className="text-space-mute text-xs mb-2">
                necesitás {m.theyHaveINeed} · podés dar {m.iHaveTheyNeed}
              </Text>
              <ProgressBar pct={pct} height={3} from={theme.accent} to={theme.accent} />
            </GlowCard>
          </Pressable>
        );
      })}
    </>
  );
}
