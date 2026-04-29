import { ScrollView, View, Text } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { ProgressBar } from "@/ui/ProgressBar";
import { useProgress } from "@/hooks/useProgress";

export default function Home() {
  const { data, isLoading } = useProgress();

  return (
    <StarryBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">
          MUNDIAL 2026
        </Text>

        {isLoading || !data ? (
          <Text className="text-space-mute">Cargando…</Text>
        ) : (
          <>
            <GlowCard className="mb-4">
              <Text className="text-space-mute text-xs tracking-widest mb-1">PROGRESO</Text>
              <Text className="text-space-ink text-3xl font-extrabold mb-2">
                {data.collected} / {data.total}
              </Text>
              <ProgressBar pct={data.pct} />
              <Text className="text-space-mute text-xs mt-2">
                {data.duplicates > 0 ? `${data.duplicates} repetidas` : "Sin repetidas"}
              </Text>
            </GlowCard>

            <Text className="text-space-mute text-xs tracking-widest mb-2">POR SECCIÓN</Text>
            {data.bySection.map((s) => (
              <GlowCard key={s.section} className="mb-2">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-space-ink font-semibold">{s.section}</Text>
                  <Text className="text-space-mute text-xs">
                    {s.collected}/{s.total}
                  </Text>
                </View>
                <ProgressBar pct={s.pct} height={4} />
              </GlowCard>
            ))}
          </>
        )}
      </ScrollView>
    </StarryBackground>
  );
}
