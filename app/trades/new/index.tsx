// app/trades/new/index.tsx
import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useFriends } from "@/hooks/useFriends";
import { useMatches } from "@/hooks/useMatches";
import { useTheme } from "@/theme/ThemeProvider";

export default function NewTradeStep1() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: friends } = useFriends();
  const { summary } = useMatches();
  const matchMap = useMemo(
    () => new Map(summary.map((s) => [s.friendId, s.matchCount])),
    [summary]
  );

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = friends ?? [];
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return list;
    return list.filter(
      (f) =>
        f.username.toLowerCase().includes(trimmed) ||
        (f.displayName ?? "").toLowerCase().includes(trimmed)
    );
  }, [friends, q]);

  return (
    <ThemedBackground>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
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
            <Text style={{ color: theme.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800", flex: 1 }}>
            Nuevo trueque
          </Text>
          <Text style={{ color: theme.textMute, fontSize: 12 }}>1 / 2</Text>
        </View>

        <Text style={{ color: theme.textMute, fontSize: 13, marginBottom: 12 }}>
          ¿Con quién querés intercambiar?
        </Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar amigo…"
          placeholderTextColor={theme.textMute}
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            backgroundColor: theme.card,
            color: theme.text,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            marginBottom: 16
          }}
        />

        <Text style={{ color: theme.textMute, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginBottom: 8 }}>
          ALGUIEN NUEVO
        </Text>
        <Pressable
          onPress={() => router.push("/add-friend/scan" as never)}
          accessibilityRole="button"
          accessibilityLabel="Escanear código de amigo"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            marginBottom: 8
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "600" }}>📷  Escanear código</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/add-friend/search" as never)}
          accessibilityRole="button"
          accessibilityLabel="Buscar por username"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            marginBottom: 16
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "600" }}>⌕  Buscar por @username</Text>
        </Pressable>

        <Text style={{ color: theme.textMute, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginBottom: 8 }}>
          MIS AMIGOS
        </Text>
        {filtered.length === 0 ? (
          <Text style={{ color: theme.textMute, fontSize: 13, marginTop: 12, textAlign: "center" }}>
            {q.trim().length > 0
              ? `Sin amigos que matcheen "${q}". Probá scan o buscar @.`
              : "Todavía no tenés amigos. Agregalo desde Escanear o Buscar."}
          </Text>
        ) : (
          filtered.map((f) => {
            const count = matchMap.get(f.id) ?? 0;
            return (
              <Pressable
                key={f.id}
                onPress={() => router.push(`/trades/propose/${f.username}` as never)}
                accessibilityRole="button"
                accessibilityLabel={`Proponer trueque a @${f.username}`}
              >
                <GlowCard className="mb-2">
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: "700" }}>
                    @{f.username}
                  </Text>
                  {count > 0 && (
                    <Text style={{ color: theme.accent, fontSize: 12, marginTop: 2 }}>
                      {count} match{count === 1 ? "" : "es"}
                    </Text>
                  )}
                </GlowCard>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </ThemedBackground>
  );
}
