import { useState } from "react";
import { ScrollView, View, Text, Pressable, RefreshControl, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { haptics } from "@/lib/haptics";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { EmptyState } from "@/ui/EmptyState";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { ProgressBar } from "@/ui/ProgressBar";
import { useMatches } from "@/hooks/useMatches";
import { useNearbyMatches } from "@/hooks/useNearbyMatches";
import {
  usePendingRequests,
  useOutgoingRequests,
  useAcceptRequest,
  useDeclineRequest,
  useDeleteMyOutgoingRequest
} from "@/hooks/usePendingRequests";
import { useSession } from "@/auth/useSession";
import { useTheme } from "@/theme/ThemeProvider";
import { MatchCard } from "@/ui/MatchCard";

type Tab = "matches" | "nearby" | "requests";

export default function Trades() {
  const [tab, setTab] = useState<Tab>("matches");
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await haptics.light();
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] }),
      qc.invalidateQueries({ queryKey: ["matches"] }),
      qc.invalidateQueries({ queryKey: ["friends"] }),
      qc.invalidateQueries({ queryKey: ["pendingRequests"] }),
      qc.invalidateQueries({ queryKey: ["outgoingRequests"] })
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
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">CAMBIOS</Text>

        <View className="mb-4">
          <SegmentedControl<Tab>
            options={[
              { value: "matches", label: "Matches" },
              { value: "nearby", label: "Cerca de mí" },
              { value: "requests", label: "Solicitudes" }
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === "matches" ? (
          <MatchesView />
        ) : tab === "nearby" ? (
          <NearbyView />
        ) : (
          <RequestsView />
        )}
      </ScrollView>
    </ThemedBackground>
  );
}

function MatchesView() {
  const router = useRouter();
  const { theme } = useTheme();
  const { summary, isLoading } = useMatches();

  if (isLoading) return <Text style={{ color: theme.textMute, textAlign: "center", marginTop: 16 }}>Cargando…</Text>;

  if (summary.length === 0) {
    return (
      <>
        <EmptyState variant="rocket" title="Sin matches todavía" message="Agrega amigos desde Perfil." />
        <Pressable
          onPress={() => router.push("/profile" as never)}
          accessibilityRole="button"
          accessibilityLabel="Compartir tu lista"
          style={{
            marginTop: 12,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: "center"
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "600" }}>Comparte tu lista</Text>
        </Pressable>
      </>
    );
  }

  return (
    <>
      {summary.map((s) => (
        <MatchCard key={s.friendId} summary={s} />
      ))}
    </>
  );
}

function NearbyView() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSession();
  const { data, isLoading, isFetching, refetch } = useNearbyMatches();

  const onReload = async () => {
    await haptics.light();
    await refetch();
  };

  if (!user?.discoverable) {
    return (
      <EmptyState
        variant="rocket"
        title="Permite que te encuentren"
        message="Ve a Perfil → Editar para activar «Que me encuentren» y que personas de tu ciudad puedan contactarte."
      />
    );
  }

  return (
    <>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-space-mute text-xs tracking-widest">
          {user.city_label ?? "TU CIUDAD"}
        </Text>
        <Pressable
          onPress={onReload}
          disabled={isFetching}
          accessibilityRole="button"
          accessibilityLabel="Actualizar matches cercanos"
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            opacity: isFetching ? 0.6 : 1
          }}
        >
          {isFetching ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>↻ Actualizar</Text>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <Text className="text-space-mute text-center mt-4">Cargando…</Text>
      ) : !data || data.length === 0 ? (
        <EmptyState
          variant="rocket"
          title="Sin matches cerca todavía"
          message={`Nadie en ${user.city_label ?? "tu ciudad"} tiene complementarios contigo por ahora. Toca Actualizar o vuelve después.`}
        />
      ) : (
        data.map((m) => {
          const maxScore = data[0]?.score ?? m.score;
          const pct = maxScore > 0 ? m.score / maxScore : 0;
          return (
            <Pressable
              key={m.themId}
              onPress={() => router.push(`/nearby/${m.username}` as never)}
              accessibilityLabel={`Ver match con @${m.username}, score ${m.score}`}
              accessibilityRole="button"
            >
              <GlowCard className="mb-2">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-space-ink font-semibold">@{m.username}</Text>
                  <Text style={{ color: theme.accent, fontWeight: "700" }}>score {m.score}</Text>
                </View>
                <Text className="text-space-mute text-xs mb-2">
                  necesitas {m.theyHaveINeed} · puedes dar {m.iHaveTheyNeed}
                </Text>
                <ProgressBar pct={pct} height={3} from={theme.accent} to={theme.accent} />
              </GlowCard>
            </Pressable>
          );
        })
      )}
    </>
  );
}

function RequestsView() {
  const { theme } = useTheme();
  const incoming = usePendingRequests();
  const outgoing = useOutgoingRequests();
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const remove = useDeleteMyOutgoingRequest();

  const isLoading = incoming.isLoading || outgoing.isLoading;
  const hasIncoming = (incoming.data?.length ?? 0) > 0;
  const hasOutgoing = (outgoing.data?.length ?? 0) > 0;

  if (isLoading) return <ActivityIndicator color={theme.accent} />;
  if (!hasIncoming && !hasOutgoing) {
    return (
      <EmptyState
        variant="rocket"
        title="Sin solicitudes"
        message="Las solicitudes que recibes y las que envías aparecen aquí."
      />
    );
  }

  return (
    <>
      {hasIncoming && (
        <>
          <Text className="text-space-mute text-xs tracking-widest mb-2">RECIBIDAS</Text>
          {incoming.data!.map((r) => (
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
        </>
      )}

      {hasOutgoing && (
        <>
          <Text className="text-space-mute text-xs tracking-widest mb-2 mt-4">ENVIADAS</Text>
          {outgoing.data!.map((r) => {
            const isPending = r.status === "pending";
            const statusLabel = isPending ? "Pendiente" : "Rechazada";
            const statusColor = isPending ? theme.textMute : "#dc2626";
            const buttonLabel = isPending ? "Cancelar" : "Borrar";
            return (
              <GlowCard key={r.recipientId} className="mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
                    @{r.username}
                    {r.cityLabel ? (
                      <Text style={{ color: theme.textMute, fontSize: 12, fontWeight: "400" }}>  · {r.cityLabel}</Text>
                    ) : null}
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
                {r.message ? (
                  <Text style={{ color: theme.textMute, fontSize: 13, marginTop: 4, fontStyle: "italic" }}>
                    «{r.message}»
                  </Text>
                ) : null}
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
        </>
      )}
    </>
  );
}
