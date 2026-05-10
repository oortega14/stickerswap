import { useMemo, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useNearbyMatches } from "@/hooks/useNearbyMatches";
import { requestNearbyTrade } from "@/social/nearbyMatches";
import { useTheme } from "@/theme/ThemeProvider";

export default function NearbyDetail() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const { data } = useNearbyMatches();
  const [msg, setMsg] = useState("");

  const match = useMemo(() => data?.find((m) => m.username === username) ?? null, [data, username]);

  const send = useMutation({
    mutationFn: (m: { id: string; message: string | null }) => requestNearbyTrade(m.id, m.message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] });
      Alert.alert("Solicitud enviada", "Si la acepta, los datos van a aparecer en Matches.");
      router.back();
    },
    onError: (e: unknown) => {
      const msg = (e as Error).message;
      const human =
        msg.includes("too_many_requests") ? "Llegaste al límite de 5 solicitudes pendientes por día. Espera a que respondan."
        : msg.includes("not_in_same_city") ? "Esta persona ya no está en tu ciudad o se desactivó."
        : msg.includes("message_too_long") ? "El mensaje no puede tener más de 280 caracteres."
        : msg;
      Alert.alert("No se pudo enviar", human);
    }
  });

  if (!match) {
    return (
      <ThemedBackground>
        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ color: theme.textMute }}>Match no encontrado.</Text>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text style={{ color: theme.accent }}>Volver</Text>
          </Pressable>
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>@{match.username}</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Cerrar" accessibilityRole="button">
            <Text style={{ color: theme.textMute }}>✕</Text>
          </Pressable>
        </View>

        <Text style={{ color: theme.textMute, fontSize: 13, marginBottom: 16 }}>
          {match.cityLabel} · score {match.score}
        </Text>

        <GlowCard className="mb-3">
          <Text className="text-space-mute text-xs tracking-widest mb-1">ELLOS TIENEN, TÚ NECESITAS</Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>{match.theyHaveINeed}</Text>
        </GlowCard>

        <GlowCard className="mb-4">
          <Text className="text-space-mute text-xs tracking-widest mb-1">TÚ TIENES, ELLOS NECESITAN</Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>{match.iHaveTheyNeed}</Text>
        </GlowCard>

        <GlowCard className="mb-4">
          <Text className="text-space-mute text-xs mb-1">Mensaje (opcional)</Text>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            placeholder="vi que tienes a Messi…"
            placeholderTextColor={theme.textMute}
            multiline
            maxLength={280}
            style={{
              color: theme.text,
              backgroundColor: theme.card,
              borderRadius: 8,
              padding: 10,
              minHeight: 60,
              fontSize: 14
            }}
          />
          <Text style={{ color: theme.textMute, fontSize: 11, marginTop: 4, textAlign: "right" }}>
            {msg.length}/280
          </Text>
        </GlowCard>

        <Pressable
          onPress={() => send.mutate({ id: match.themId, message: msg.trim() || null })}
          disabled={send.isPending}
          className="bg-space-purple rounded-xl py-4 items-center"
          accessibilityRole="button"
          accessibilityLabel="Solicitar cambio"
        >
          {send.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Solicitar cambio</Text>}
        </Pressable>
      </ScrollView>
    </ThemedBackground>
  );
}
