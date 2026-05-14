import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator, Linking, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { StickerMiniThumb } from "@/ui/StickerMiniThumb";
import { ActiveTradeBanner } from "@/ui/ActiveTradeBanner";
import { supabase } from "@/auth/supabaseClient";
import { useFriends } from "@/hooks/useFriends";
import { useFriendContacts } from "@/hooks/useContacts";
import { useTradeForFriend } from "@/hooks/useTradeForFriend";
import { whatsappUrl, instagramUrl } from "@/social/contacts";
import { listStatuses } from "@/data/stickerStatus";
import { listStickers } from "@/data/stickers";
import { buildBidirectional } from "@/domain/friendMatchBuilder";
import type { BidirectionalMatch, StickerStatus, Sticker } from "@/domain/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function FriendDetail() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data: friends } = useFriends();
  const friend = friends?.find((f) => f.username === username);
  const { data: contacts } = useFriendContacts(friend?.id);
  const trade = useTradeForFriend(friend?.id ?? "");

  const [match, setMatch] = useState<BidirectionalMatch | null>(null);
  const [stickersBySection, setStickersBySection] = useState<Map<string, Sticker>>(new Map());
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const wa = whatsappUrl(contacts?.whatsapp);
  const ig = instagramUrl(contacts?.instagram);

  const openLink = async (url: string) => {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("No se pudo abrir", "Tu dispositivo no tiene una app que abra este enlace.");
      return;
    }
    await Linking.openURL(url);
  };

  useEffect(() => {
    if (!friend) return;
    (async () => {
      setLoading(true);
      const allStickers = await listStickers();
      const map = new Map(allStickers.map((s) => [s.code, s]));
      setStickersBySection(map);
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

  const grouped = useMemo(() => {
    if (!match) return null;
    const minNumberFor = (codes: string[]) =>
      codes.reduce((min, c) => {
        const n = stickersBySection.get(c)?.number ?? Number.MAX_SAFE_INTEGER;
        return n < min ? n : min;
      }, Number.MAX_SAFE_INTEGER);
    const groupCodes = (codes: string[]) => {
      const out = new Map<string, string[]>();
      for (const code of codes) {
        const sticker = stickersBySection.get(code);
        const section = sticker?.section ?? "OTROS";
        const arr = out.get(section) ?? [];
        arr.push(code);
        out.set(section, arr);
      }
      // Orden de álbum: el menor sticker number de cada sección.
      return Array.from(out.entries()).sort(
        (a, b) => minNumberFor(a[1]) - minNumberFor(b[1])
      );
    };
    return {
      need: groupCodes(match.theyHaveYouNeed.map((m) => m.stickerCode)),
      give: groupCodes(match.youHaveTheyNeed.map((m) => m.stickerCode))
    };
  }, [match, stickersBySection]);

  if (!friend) {
    return (
      <ThemedBackground>
        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ color: theme.textMute, marginBottom: 16 }}>Amigo no encontrado.</Text>
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

  const canPropose =
    !trade && match && match.theyHaveYouNeed.length > 0 && match.youHaveTheyNeed.length > 0;

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }}>
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
            <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 11, letterSpacing: 1 }}>
              @{friend.username}
            </Text>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: "700" }}>
              {friend.displayName ?? friend.username}
            </Text>
          </View>
        </View>

        {trade ? <ActiveTradeBanner trade={trade} /> : null}

        {(wa || ig) && (
          <View className="flex-row mb-4" style={{ gap: 8 }}>
            {wa && (
              <Pressable
                onPress={() => openLink(wa)}
                accessibilityRole="button"
                accessibilityLabel="Abrir WhatsApp"
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#25D366", alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>WhatsApp</Text>
              </Pressable>
            )}
            {ig && (
              <Pressable
                onPress={() => openLink(ig)}
                accessibilityRole="button"
                accessibilityLabel="Abrir Instagram"
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#E1306C", alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Instagram</Text>
              </Pressable>
            )}
          </View>
        )}

        {!wa && !ig && (
          <Text style={{ color: theme.textMute, fontSize: 12, textAlign: "center", marginBottom: 12 }}>
            {friend.displayName ?? friend.username} no compartió contacto.
          </Text>
        )}

        {loading || !match || !grouped ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <>
            <BidirectionalSection
              title={`TIENE LO QUE NECESITAS · ${match.theyHaveYouNeed.length}`}
              groups={grouped.need}
              stickers={stickersBySection}
              onTeamPress={(code) => router.push(`/album/${code}` as never)}
              onThumbPress={(code) => router.push(`/sticker/${code}` as never)}
            />
            <BidirectionalSection
              title={`TIENES LO QUE NECESITA · ${match.youHaveTheyNeed.length}`}
              groups={grouped.give}
              stickers={stickersBySection}
              onTeamPress={(code) => router.push(`/album/${code}` as never)}
              onThumbPress={(code) => router.push(`/sticker/${code}` as never)}
            />
          </>
        )}
      </ScrollView>

      {canPropose && (
        <View style={{ position: "absolute", bottom: insets.bottom + 16, left: 16, right: 16 }}>
          <Pressable
            onPress={() => router.push(`/trades/propose/${friend.username}` as never)}
            accessibilityRole="button"
            accessibilityLabel={`Proponer cambio a ${friend.username}`}
            style={{
              paddingVertical: 14,
              borderRadius: 10,
              backgroundColor: theme.accent,
              alignItems: "center"
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Proponer cambio</Text>
          </Pressable>
        </View>
      )}
    </ThemedBackground>
  );
}

function BidirectionalSection({
  title,
  groups,
  stickers,
  onTeamPress,
  onThumbPress
}: {
  title: string;
  groups: [string, string[]][];
  stickers: Map<string, Sticker>;
  onTeamPress: (teamCode: string) => void;
  onThumbPress: (code: string) => void;
}) {
  const { theme } = useTheme();
  if (groups.length === 0) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 }}>
          {title}
        </Text>
        <Text style={{ color: theme.textMute, fontSize: 13 }}>(nada por ahora)</Text>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 }}>
        {title}
      </Text>
      {groups.map(([section, codes]) => {
        const teamCode = stickers.get(codes[0])?.team ?? null;
        return (
          <View key={section} style={{ marginBottom: 10 }}>
            <Pressable
              onPress={() => teamCode && onTeamPress(teamCode)}
              disabled={!teamCode}
              accessibilityRole={teamCode ? "button" : undefined}
              accessibilityLabel={teamCode ? `Abrir equipo ${section}` : undefined}
            >
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
                {section} ({codes.length}){teamCode ? " ›" : ""}
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {codes.map((c) => (
                <StickerMiniThumb key={c} code={c} onPress={() => onThumbPress(c)} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
