import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { StickerMiniThumb } from "@/ui/StickerMiniThumb";
import { showSnackbar } from "@/ui/Snackbar";
import { useFriends } from "@/hooks/useFriends";
import { useTradeForFriend } from "@/hooks/useTradeForFriend";
import { useProposeTrade } from "@/hooks/useProposeTrade";
import { supabase } from "@/auth/supabaseClient";
import { listStatuses } from "@/data/stickerStatus";
import { buildBidirectional } from "@/domain/friendMatchBuilder";
import { buildDefaultProposal } from "@/domain/tradeProposalBuilder";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme/ThemeProvider";
import type { BidirectionalMatch, StickerStatus } from "@/domain/types";

export default function ProposeTradeScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data: friends } = useFriends();
  const friend = friends?.find((f) => f.username === username);
  const propose = useProposeTrade();
  const existing = useTradeForFriend(friend?.id ?? "");

  const [bidi, setBidi] = useState<BidirectionalMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [givesSet, setGivesSet] = useState<Set<string>>(new Set());
  const [getsSet, setGetsSet] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!friend) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sticker_status")
        .select("sticker_code, count, updated_at")
        .eq("user_id", friend.id);
      const fStatuses: StickerStatus[] = (data ?? []).map((r) => ({
        stickerCode: r.sticker_code as string,
        count: r.count as number,
        updatedAt: Date.parse(r.updated_at as string)
      }));
      const myStatuses = await listStatuses();
      const computed = buildBidirectional(friend.id, myStatuses, fStatuses);
      if (cancelled) return;
      setBidi(computed);
      const draft = buildDefaultProposal(friend.id, computed);
      setGivesSet(new Set(draft.proposerGives));
      setGetsSet(new Set(draft.proposerGets));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [friend?.id]);

  const canSubmit = useMemo(
    () => givesSet.size > 0 && getsSet.size > 0 && !existing && !propose.isPending,
    [givesSet, getsSet, existing, propose.isPending]
  );

  const onSubmit = async () => {
    if (!friend || !canSubmit) return;
    await haptics.medium();
    propose.mutate(
      {
        recipientId: friend.id,
        proposerGives: Array.from(givesSet),
        proposerGets: Array.from(getsSet),
        message: message.trim() || undefined
      },
      {
        onSuccess: () => {
          showSnackbar("Propuesta enviada · esperando respuesta");
          router.back();
        },
        onError: (e: unknown) => {
          Alert.alert("No se pudo enviar", (e as Error).message);
        }
      }
    );
  };

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, code: string) => {
    const next = new Set(set);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSet(next);
  };

  if (!friend) {
    return (
      <ThemedBackground>
        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ color: theme.textMute }}>Amigo no encontrado.</Text>
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }}
      >
        <View className="flex-row items-center mb-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
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
            <Text style={{ color: theme.text }}>✕</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700", flex: 1 }}>
            Proponer cambio a @{friend.username}
          </Text>
        </View>

        {existing && (
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              marginBottom: 12
            }}
          >
            <Text style={{ color: theme.text, fontSize: 13 }}>
              Ya tienes un cambio en curso con @{friend.username}. Resuélvelo desde Cambios o desde su perfil.
            </Text>
          </View>
        )}

        {loading || !bidi ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <>
            <Section
              title={`LE DOY (${givesSet.size})`}
              codes={bidi.youHaveTheyNeed.map((m) => m.stickerCode)}
              selected={givesSet}
              onToggle={(c) => toggle(givesSet, setGivesSet, c)}
            />
            <Section
              title={`LE PIDO (${getsSet.size})`}
              codes={bidi.theyHaveYouNeed.map((m) => m.stickerCode)}
              selected={getsSet}
              onToggle={(c) => toggle(getsSet, setGetsSet, c)}
            />
            <Text
              style={{
                color: theme.textMute,
                fontSize: 11,
                fontWeight: "700",
                marginTop: 14,
                marginBottom: 6,
                letterSpacing: 1
              }}
            >
              MENSAJE OPCIONAL ({message.length}/280)
            </Text>
            <TextInput
              value={message}
              onChangeText={(v) => setMessage(v.slice(0, 280))}
              placeholder="Hola, ¿cambiamos?"
              placeholderTextColor={theme.textMute}
              multiline
              style={{
                backgroundColor: theme.card,
                color: theme.text,
                borderColor: theme.border,
                borderWidth: 1,
                borderRadius: 10,
                padding: 10,
                minHeight: 70,
                fontSize: 14
              }}
            />
          </>
        )}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: insets.bottom + 16,
          left: 16,
          right: 16
        }}
      >
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={{
            paddingVertical: 14,
            borderRadius: 10,
            backgroundColor: canSubmit ? theme.accent : theme.card,
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.border
          }}
          accessibilityRole="button"
          accessibilityLabel="Enviar propuesta"
        >
          {propose.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: canSubmit ? "#fff" : theme.textMute, fontWeight: "700" }}>
              Enviar propuesta
            </Text>
          )}
        </Pressable>
      </View>
    </ThemedBackground>
  );
}

function Section({
  title,
  codes,
  selected,
  onToggle
}: {
  title: string;
  codes: string[];
  selected: Set<string>;
  onToggle: (code: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: theme.textMute,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1,
          marginBottom: 8
        }}
      >
        {title}
      </Text>
      {codes.length === 0 ? (
        <Text style={{ color: theme.textMute, fontSize: 13 }}>
          (no hay láminas en este lado)
        </Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {codes.map((c) => (
            <View
              key={c}
              style={{
                opacity: selected.has(c) ? 1 : 0.35
              }}
            >
              <StickerMiniThumb code={c} onPress={() => onToggle(c)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
