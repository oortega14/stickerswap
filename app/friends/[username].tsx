import { useEffect, useState } from "react";
import { ScrollView, View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { supabase } from "@/auth/supabaseClient";
import { useFriends } from "@/hooks/useFriends";
import { listStatuses } from "@/data/stickerStatus";
import { buildBidirectional } from "@/domain/friendMatchBuilder";
import type { BidirectionalMatch, StickerStatus } from "@/domain/types";

export default function FriendDetail() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { data: friends } = useFriends();
  const friend = friends?.find((f) => f.username === username);
  const [match, setMatch] = useState<BidirectionalMatch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!friend) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sticker_status")
        .select("sticker_code, count, updated_at")
        .eq("user_id", friend.id);
      const friendStatuses: StickerStatus[] = (data ?? []).map((r) => ({
        stickerCode: r.sticker_code as string,
        count: r.count as number,
        updatedAt: Date.parse(r.updated_at as string)
      }));
      const myStatuses = await listStatuses();
      setMatch(buildBidirectional(friend.id, myStatuses, friendStatuses));
      setLoading(false);
    })();
  }, [friend?.id]);

  if (!friend) {
    return (
      <ThemedBackground>
        <View className="flex-1 items-center justify-center">
          <Text className="text-space-mute">Amigo no encontrado.</Text>
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-2">
          @{friend.username}
        </Text>
        <Text className="text-space-ink text-xl font-bold mb-4">
          {friend.displayName ?? friend.username}
        </Text>

        {loading ? (
          <ActivityIndicator color="#7c5cff" />
        ) : match ? (
          <>
            <GlowCard className="mb-3">
              <Text className="text-space-mute text-xs mb-1">TIENE QUE NECESITÁS</Text>
              <Text className="text-space-ink text-2xl font-bold">
                {match.theyHaveYouNeed.length}
              </Text>
              <Text className="text-space-mute text-xs mt-1">
                {match.theyHaveYouNeed.slice(0, 10).map((m) => m.stickerCode).join(", ")}
                {match.theyHaveYouNeed.length > 10 ? "…" : ""}
              </Text>
            </GlowCard>

            <GlowCard className="mb-3">
              <Text className="text-space-mute text-xs mb-1">TENÉS QUE NECESITA</Text>
              <Text className="text-space-ink text-2xl font-bold">
                {match.youHaveTheyNeed.length}
              </Text>
              <Text className="text-space-mute text-xs mt-1">
                {match.youHaveTheyNeed.slice(0, 10).map((m) => m.stickerCode).join(", ")}
                {match.youHaveTheyNeed.length > 10 ? "…" : ""}
              </Text>
            </GlowCard>
          </>
        ) : null}
      </ScrollView>
    </ThemedBackground>
  );
}
