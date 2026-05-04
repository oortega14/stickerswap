import { ScrollView, View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { EmptyState } from "@/ui/EmptyState";
import {
  usePendingRequests,
  useAcceptRequest,
  useDeclineRequest
} from "@/hooks/usePendingRequests";
import { useTheme } from "@/theme/ThemeProvider";

export default function RequestsInbox() {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, isLoading } = usePendingRequests();
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>Solicitudes</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Volver"
            accessibilityRole="button"
          >
            <Text style={{ color: theme.textMute, fontSize: 14 }}>‹ Volver</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.accent} />
        ) : !data || data.length === 0 ? (
          <EmptyState variant="rocket" title="Sin solicitudes" message="Cuando alguien te pida un intercambio, aparece acá." />
        ) : (
          data.map((r) => (
            <GlowCard key={r.requesterId} className="mb-3">
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
                @{r.username}
                {r.cityLabel ? <Text style={{ color: theme.textMute, fontSize: 12, fontWeight: "400" }}>  · {r.cityLabel}</Text> : null}
              </Text>
              {r.message ? (
                <Text style={{ color: theme.text, fontSize: 14, marginTop: 6 }}>«{r.message}»</Text>
              ) : null}
              <View className="flex-row mt-3" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => accept.mutate(r.requesterId)}
                  disabled={accept.isPending || decline.isPending}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: theme.accent,
                    alignItems: "center"
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Aceptar solicitud de ${r.username}`}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Aceptar</Text>
                </Pressable>
                <Pressable
                  onPress={() => decline.mutate(r.requesterId)}
                  disabled={accept.isPending || decline.isPending}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: "center"
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Rechazar solicitud de ${r.username}`}
                >
                  <Text style={{ color: theme.textMute, fontWeight: "700" }}>Rechazar</Text>
                </Pressable>
              </View>
            </GlowCard>
          ))
        )}
      </ScrollView>
    </ThemedBackground>
  );
}
