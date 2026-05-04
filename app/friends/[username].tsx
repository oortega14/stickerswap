import { useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator, Linking, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { supabase } from "@/auth/supabaseClient";
import { useFriends } from "@/hooks/useFriends";
import { useFriendContacts } from "@/hooks/useContacts";
import { whatsappUrl, instagramUrl } from "@/social/contacts";
import { listStatuses } from "@/data/stickerStatus";
import { buildBidirectional } from "@/domain/friendMatchBuilder";
import type { BidirectionalMatch, StickerStatus } from "@/domain/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function FriendDetail() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data: friends } = useFriends();
  const friend = friends?.find((f) => f.username === username);
  const { data: contacts } = useFriendContacts(friend?.id);
  const [match, setMatch] = useState<BidirectionalMatch | null>(null);
  const [loading, setLoading] = useState(true);

  const wa = whatsappUrl(contacts?.whatsapp);
  const ig = instagramUrl(contacts?.instagram);

  const openLink = async (url: string) => {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("No se pudo abrir", "Tu device no tiene una app que maneje este enlace.");
      return;
    }
    await Linking.openURL(url);
  };

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
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-space-mute mb-4">Amigo no encontrado.</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border
            }}
          >
            <Text style={{ color: theme.text }}>‹ Volver</Text>
          </Pressable>
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center mb-4">
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
              justifyContent: "center",
              marginRight: 12
            }}
          >
            <Text style={{ color: theme.text, fontSize: 16 }}>‹</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-space-violet font-bold tracking-widest text-xs">
              @{friend.username}
            </Text>
            <Text className="text-space-ink text-xl font-bold">
              {friend.displayName ?? friend.username}
            </Text>
          </View>
        </View>

        {(wa || ig) && (
          <View className="flex-row mb-4" style={{ gap: 8 }}>
            {wa && (
              <Pressable
                onPress={() => openLink(wa)}
                accessibilityRole="button"
                accessibilityLabel="Abrir WhatsApp"
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#25D366",
                  alignItems: "center"
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>WhatsApp</Text>
              </Pressable>
            )}
            {ig && (
              <Pressable
                onPress={() => openLink(ig)}
                accessibilityRole="button"
                accessibilityLabel="Abrir Instagram"
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#E1306C",
                  alignItems: "center"
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Instagram</Text>
              </Pressable>
            )}
          </View>
        )}

        {!wa && !ig && (
          <Text className="text-space-mute text-xs mb-4 text-center">
            {friend.displayName ?? friend.username} no compartió contacto. Pueden coordinar el intercambio en persona o pedirle que active WhatsApp/Instagram en su Perfil → Editar.
          </Text>
        )}

        {loading ? (
          <ActivityIndicator color={theme.accent} />
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
