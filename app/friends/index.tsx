import { FlatList, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useFriends } from "@/hooks/useFriends";
import { useMatches } from "@/hooks/useMatches";

export default function FriendsList() {
  const router = useRouter();
  const { data: friends } = useFriends();
  const { summary } = useMatches();
  const matchMap = new Map(summary.map((s) => [s.friendId, s.matchCount]));

  return (
    <StarryBackground>
      <View className="flex-1 px-4 pt-14">
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">AMIGOS</Text>
        <FlatList
          data={friends ?? []}
          keyExtractor={(f) => f.id}
          ListEmptyComponent={
            <Text className="text-space-mute text-center mt-8">
              Todavía no tenés amigos. Compartí tu código en Perfil.
            </Text>
          }
          renderItem={({ item }) => {
            const count = matchMap.get(item.id) ?? 0;
            return (
              <Pressable onPress={() => router.push(`/friends/${item.username}` as never)}>
                <GlowCard className="mb-2">
                  <Text className="text-space-ink font-semibold">
                    {item.displayName ?? item.username}
                  </Text>
                  <Text className="text-space-mute text-xs">@{item.username}</Text>
                  {count > 0 && (
                    <Text className="text-space-violet text-xs mt-1">
                      {count} match{count === 1 ? "" : "es"} con vos
                    </Text>
                  )}
                </GlowCard>
              </Pressable>
            );
          }}
        />
      </View>
    </StarryBackground>
  );
}
