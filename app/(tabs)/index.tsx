import { View, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedScrollHandler } from "react-native-reanimated";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { ProgressBar } from "@/ui/ProgressBar";
import { Skeleton } from "@/ui/Skeleton";
import { useProgress } from "@/hooks/useProgress";
import { usePendingCount } from "@/hooks/usePendingCount";

export default function Home() {
  const { data, isLoading } = useProgress();
  const { data: pending } = usePendingCount();

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    }
  });

  return (
    <StarryBackground parallaxScrollY={scrollY}>
      <Animated.ScrollView
        className="flex-1 px-4 pt-14"
        contentContainerStyle={{ paddingBottom: 32 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
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
      </Animated.ScrollView>
    </StarryBackground>
  );
}
