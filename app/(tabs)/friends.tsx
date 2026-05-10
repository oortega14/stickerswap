import { useState } from "react";
import { ScrollView, View, Text, Pressable, RefreshControl, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { haptics } from "@/lib/haptics";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { EmptyState } from "@/ui/EmptyState";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { useFriends } from "@/hooks/useFriends";
import { useMatches } from "@/hooks/useMatches";
import {
  usePendingRequests,
  useOutgoingRequests,
  useAcceptRequest,
  useDeclineRequest,
  useDeleteMyOutgoingRequest
} from "@/hooks/usePendingRequests";
import { useTheme } from "@/theme/ThemeProvider";

type Subtab = "amigos" | "trueques" | "cerca";

export default function Friends() {
  const [tab, setTab] = useState<Subtab>("amigos");
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await haptics.light();
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["friends"] }),
      qc.invalidateQueries({ queryKey: ["matches"] }),
      qc.invalidateQueries({ queryKey: ["pendingRequests"] }),
      qc.invalidateQueries({ queryKey: ["outgoingRequests"] }),
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] }),
      qc.invalidateQueries({ queryKey: ["trades"] })
    ]);
    setRefreshing(false);
  };

  return (
    <ThemedBackground>
      <ScrollView
        className="flex-1 px-4 pt-14"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">AMIGOS</Text>

        <View className="mb-4">
          <SegmentedControl<Subtab>
            options={[
              { value: "amigos", label: "Amigos" },
              { value: "trueques", label: "Trueques" },
              { value: "cerca", label: "Cerca" }
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === "amigos" ? (
          <AmigosView />
        ) : tab === "trueques" ? (
          <TruequesView />
        ) : (
          <CercaView />
        )}
      </ScrollView>
    </ThemedBackground>
  );
}

function AmigosView() {
  const router = useRouter();
  const { theme } = useTheme();
  const incoming = usePendingRequests();
  const outgoing = useOutgoingRequests();
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const remove = useDeleteMyOutgoingRequest();
  const { data: friends } = useFriends();
  const { summary } = useMatches();
  const matchMap = new Map(summary.map((s) => [s.friendId, s.matchCount]));

  const hasIncoming = (incoming.data?.length ?? 0) > 0;
  const hasOutgoing = (outgoing.data?.length ?? 0) > 0;
  const hasRequests = hasIncoming || hasOutgoing;

  return (
    <View>
      {hasRequests && (
        <View className="mb-6">
          <Text className="text-space-mute text-xs tracking-widest mb-2">SOLICITUDES</Text>
          {hasIncoming &&
            incoming.data!.map((r) => (
              <GlowCard key={`in-${r.requesterId}`} className="mb-3">
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
                  @{r.username}
                  {r.cityLabel ? (
                    <Text style={{ color: theme.textMute, fontSize: 12, fontWeight: "400" }}>
                      {"  · "}{r.cityLabel}
                    </Text>
                  ) : null}
                </Text>
                {r.message ? (
                  <Text style={{ color: theme.text, fontSize: 14, marginTop: 6 }}>«{r.message}»</Text>
                ) : null}
                <View className="flex-row mt-3" style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      accept.mutate(r.requesterId, {
                        onError: (e: unknown) => {
                          const msg = (e as Error).message;
                          const human = msg.includes("request_not_found")
                            ? "Esta solicitud ya no existe."
                            : msg;
                          Alert.alert("No se pudo aceptar", human);
                        }
                      });
                    }}
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
            ))}
          {hasOutgoing &&
            outgoing.data!.map((r) => {
              const isPending = r.status === "pending";
              const buttonLabel = isPending ? "Cancelar" : "Borrar";
              const statusLabel = isPending ? "Pendiente" : "Rechazada";
              const statusColor = isPending ? theme.textMute : "#dc2626";
              return (
                <GlowCard key={`out-${r.recipientId}`} className="mb-3">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
                      @{r.username}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                        backgroundColor: isPending ? theme.card : "#fee2e2",
                        borderWidth: 1,
                        borderColor: isPending ? theme.border : "#fca5a5"
                      }}
                    >
                      <Text style={{ color: statusColor, fontSize: 10, fontWeight: "700" }}>{statusLabel}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => remove.mutate(r.recipientId)}
                    disabled={remove.isPending}
                    style={{
                      marginTop: 10,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: theme.card,
                      borderWidth: 1,
                      borderColor: theme.border,
                      alignItems: "center"
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${buttonLabel} solicitud a ${r.username}`}
                  >
                    <Text style={{ color: theme.textMute, fontSize: 13, fontWeight: "600" }}>
                      {buttonLabel}
                    </Text>
                  </Pressable>
                </GlowCard>
              );
            })}
        </View>
      )}

      <Text className="text-space-mute text-xs tracking-widest mb-2">MIS AMIGOS</Text>
      {!friends || friends.length === 0 ? (
        <EmptyState variant="planet" title="Sin amigos" message="Comparte tu código en Perfil." />
      ) : (
        friends.map((item) => {
          const count = matchMap.get(item.id) ?? 0;
          return (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/friends/${item.username}` as never)}
              accessibilityLabel={`Ver perfil de @${item.username}`}
              accessibilityRole="button"
            >
              <GlowCard className="mb-2">
                <Text className="text-space-ink font-semibold">
                  {item.displayName ?? item.username}
                </Text>
                <Text className="text-space-mute text-xs">@{item.username}</Text>
                {count > 0 && (
                  <Text className="text-space-violet text-xs mt-1">
                    {count} match{count === 1 ? "" : "es"} contigo
                  </Text>
                )}
              </GlowCard>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

function TruequesView() {
  return null;
}

function CercaView() {
  return null;
}
