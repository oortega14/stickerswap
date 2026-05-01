import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useStickerDetail, useIncrement, useDecrement } from "@/hooks/useStickers";

export default function StickerDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { data, isLoading } = useStickerDetail(code);
  const inc = useIncrement();
  const dec = useDecrement();

  if (isLoading || !data) {
    return (
      <StarryBackground>
        <View className="flex-1 items-center justify-center">
          <Text className="text-space-mute">Cargando…</Text>
        </View>
      </StarryBackground>
    );
  }

  return (
    <StarryBackground>
      <View className="flex-1 p-6 justify-center">
        <GlowCard>
          <Text className="text-space-mute text-xs tracking-wider mb-1">#{data.number}</Text>
          <Text className="text-space-ink text-2xl font-bold mb-1">{data.name}</Text>
          {data.team && <Text className="text-space-mute mb-3">{data.team}</Text>}
          <Text className="text-space-violet text-xs uppercase tracking-widest mb-4">
            {data.section}
          </Text>

          <View className="flex-row items-center justify-between mt-4">
            <Pressable
              onPress={() => dec.mutate(data.code)}
              className="bg-space-mid rounded-lg px-4 py-2"
              accessibilityLabel="Disminuir repetida"
              accessibilityRole="button"
            >
              <Text className="text-space-ink text-lg">−</Text>
            </Pressable>
            <Text className="text-space-ink text-3xl font-bold">{data.count}</Text>
            <Pressable
              onPress={() => inc.mutate(data.code)}
              className="bg-space-purple rounded-lg px-4 py-2"
              accessibilityLabel="Aumentar repetida"
              accessibilityRole="button"
            >
              <Text className="text-white text-lg">+</Text>
            </Pressable>
          </View>
        </GlowCard>

        <Pressable
          onPress={() => router.back()}
          className="mt-6 self-center"
          accessibilityLabel="Cerrar"
          accessibilityRole="button"
        >
          <Text className="text-space-mute">Cerrar</Text>
        </Pressable>
      </View>
    </StarryBackground>
  );
}
