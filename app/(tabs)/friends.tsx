import { useState, useMemo } from "react";
import { ScrollView, View, Text, Pressable, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/auth/useSession";
import { haptics } from "@/lib/haptics";
import type { Trade, TradeStatus } from "@/domain/types";
import { useCancelTrade } from "@/hooks/useCancelTrade";
import { useConfirmTrade } from "@/hooks/useConfirmTrade";
import { useFriends } from "@/hooks/useFriends";
import { useMatches } from "@/hooks/useMatches";
import {
  usePendingRequests,
  useOutgoingRequests,
  useAcceptRequest,
  useDeclineRequest,
  useDeleteMyOutgoingRequest
} from "@/hooks/usePendingRequests";
import { useRespondTrade } from "@/hooks/useRespondTrade";
import { useTradesByStatus } from "@/hooks/useTrades";
import { useUnconfirmTrade } from "@/hooks/useUnconfirmTrade";
import { useNearbyMatches } from "@/hooks/useNearbyMatches";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { EmptyState } from "@/ui/EmptyState";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { ProgressBar } from "@/ui/ProgressBar";
import { useTheme } from "@/theme/ThemeProvider";
import { MyCodeChip } from "@/ui/MyCodeChip";
import { AddFriendChip } from "@/ui/AddFriendChip";

type Subtab = "amigos" | "trueques" | "cerca";

export default function Friends() {
  const [tab, setTab] = useState<Subtab>("amigos");
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32 }}
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

      {tab === "trueques" && (
        <Pressable
          onPress={() => router.push("/trades/new" as never)}
          accessibilityRole="button"
          accessibilityLabel="Nuevo trueque"
          style={{
            position: "absolute",
            right: 20,
            bottom: insets.bottom + 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.accent,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: theme.text,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 6,
            zIndex: 20
          }}
        >
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700", lineHeight: 30 }}>+</Text>
        </Pressable>
      )}
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
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <MyCodeChip />
        <AddFriendChip />
      </View>

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
                {r.source === "trade_combo" && (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: theme.card,
                      borderColor: theme.accent,
                      borderWidth: 1,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      marginTop: 4
                    }}
                  >
                    <Text style={{ color: theme.accent, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>
                      🔄 TRUEQUE PENDIENTE
                    </Text>
                  </View>
                )}
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
        <EmptyState variant="planet" title="Sin amigos" message="Compartí tu código (arriba) para que te agreguen." />
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

type TradeFilter = Extract<TradeStatus, "pending" | "accepted" | "completed">;

function TruequesView() {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<TradeFilter>("pending");
  const { data: trades, isLoading } = useTradesByStatus(filter);
  const { data: friends } = useFriends();
  const { user } = useSession();

  const friendsRaw = useFriends().data ?? [];
  const outgoingRequests = useOutgoingRequests().data ?? [];
  const incomingRequests = usePendingRequests().data ?? [];

  const outgoingMap = useMemo(
    () => new Map(outgoingRequests.map((r) => [r.recipientId, r.status] as const)),
    [outgoingRequests]
  );
  const outgoingUsernames = useMemo(
    () => new Map(outgoingRequests.map((r) => [r.recipientId, r.username] as const)),
    [outgoingRequests]
  );
  const incomingMap = useMemo(
    () => new Map(incomingRequests.map((r) => [r.requesterId, "pending"] as const)),
    [incomingRequests]
  );
  const incomingUsernames = useMemo(
    () => new Map(incomingRequests.map((r) => [r.requesterId, r.username] as const)),
    [incomingRequests]
  );
  const friendMap = useMemo(
    () => new Map((friends ?? []).map((f) => [f.id, f] as const)),
    [friends]
  );

  if (!user) return null;

  return (
    <View>
      <View className="flex-row mb-4" style={{ gap: 8 }}>
        {(["pending", "accepted", "completed"] as TradeFilter[]).map((f) => {
          const active = f === filter;
          const label = f === "pending" ? "Pendientes" : f === "accepted" ? "En curso" : "Completados";
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar ${label}`}
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: active ? theme.accent : theme.card,
                borderWidth: 1,
                borderColor: active ? theme.accent : theme.border
              }}
            >
              <Text
                style={{
                  color: active ? "#fff" : theme.textMute,
                  fontSize: 12,
                  fontWeight: "600"
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <Text style={{ color: theme.textMute, textAlign: "center", marginTop: 16 }}>Cargando…</Text>
      ) : !trades || trades.length === 0 ? (
        <EmptyState
          variant="rocket"
          title={
            filter === "pending"
              ? "Sin trueques pendientes"
              : filter === "accepted"
                ? "Sin trueques en curso"
                : "Sin trueques completados"
          }
          message="Cuando inicies o recibas un trueque, aparecerá acá."
        />
      ) : (
        trades.map((trade) => {
          const counterpartyId = trade.proposerId === user.id ? trade.recipientId : trade.proposerId;
          const isFriend = friendsRaw.some((f) => f.id === counterpartyId);
          const status: "pending" | "accepted" | "blocked" | "rejected" | null =
            isFriend ? "accepted"
            : outgoingMap.get(counterpartyId) ?? incomingMap.get(counterpartyId) ?? null;
          const counterpartyUsername =
            friendMap.get(counterpartyId)?.username ??
            outgoingUsernames.get(counterpartyId) ??
            incomingUsernames.get(counterpartyId) ??
            "amigo";
          return (
            <TradeCard
              key={trade.id}
              trade={trade}
              meId={user.id}
              counterpartyUsername={counterpartyUsername}
              counterpartyFriendshipStatus={status}
            />
          );
        })
      )}
    </View>
  );
}

function TradeCard({
  trade,
  meId,
  counterpartyUsername,
  counterpartyFriendshipStatus
}: {
  trade: Trade;
  meId: string;
  counterpartyUsername: string;
  counterpartyFriendshipStatus: "pending" | "accepted" | "blocked" | "rejected" | null;
}) {
  const { theme } = useTheme();
  const respond = useRespondTrade();
  const cancel = useCancelTrade();
  const confirm = useConfirmTrade();
  const unconfirm = useUnconfirmTrade();

  const iAmProposer = trade.proposerId === meId;
  const iGave = iAmProposer ? trade.proposerGives : trade.proposerGets;
  const iGot = iAmProposer ? trade.proposerGets : trade.proposerGives;
  const iConfirmed = iAmProposer ? trade.proposerConfirmedAt !== null : trade.recipientConfirmedAt !== null;
  const otherConfirmed = iAmProposer ? trade.recipientConfirmedAt !== null : trade.proposerConfirmedAt !== null;

  const waitingForFriendship = counterpartyFriendshipStatus === "pending";
  const disclaimer = iAmProposer
    ? `⏳ Esperando que @${counterpartyUsername} acepte la solicitud de amistad`
    : `⏳ Aceptá la amistad de @${counterpartyUsername} para responder este trueque`;

  const dateLabel =
    trade.status === "completed" && trade.completedAt
      ? new Date(trade.completedAt).toLocaleDateString()
      : new Date(trade.updatedAt).toLocaleDateString();

  return (
    <GlowCard className="mb-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
          @{counterpartyUsername}
        </Text>
        <Text style={{ color: theme.textMute, fontSize: 12 }}>{dateLabel}</Text>
      </View>
      <Text style={{ color: theme.textMute, fontSize: 12, marginBottom: 2 }}>
        Le diste: {iGave.join(", ")}
      </Text>
      <Text style={{ color: theme.textMute, fontSize: 12, marginBottom: 8 }}>
        Te dio: {iGot.join(", ")}
      </Text>

      {waitingForFriendship && (
        <View
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            marginBottom: 8
          }}
        >
          <Text style={{ color: theme.textMute, fontSize: 12 }}>{disclaimer}</Text>
        </View>
      )}

      {trade.status === "pending" && iAmProposer && !waitingForFriendship && (
        <Pressable
          onPress={() => cancel.mutate(trade.id)}
          disabled={cancel.isPending}
          style={{
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: "center"
          }}
          accessibilityRole="button"
          accessibilityLabel="Cancelar trueque"
        >
          <Text style={{ color: theme.textMute, fontWeight: "600" }}>Cancelar</Text>
        </Pressable>
      )}

      {trade.status === "pending" && !iAmProposer && !waitingForFriendship && (
        <View className="flex-row" style={{ gap: 8 }}>
          <Pressable
            onPress={() => respond.mutate({ tradeId: trade.id, accept: true })}
            disabled={respond.isPending}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: theme.accent,
              alignItems: "center"
            }}
            accessibilityRole="button"
            accessibilityLabel="Aceptar trueque"
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Aceptar</Text>
          </Pressable>
          <Pressable
            onPress={() => respond.mutate({ tradeId: trade.id, accept: false })}
            disabled={respond.isPending}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center"
            }}
            accessibilityRole="button"
            accessibilityLabel="Rechazar trueque"
          >
            <Text style={{ color: theme.textMute, fontWeight: "600" }}>Rechazar</Text>
          </Pressable>
        </View>
      )}

      {trade.status === "accepted" && !iConfirmed && (
        <Pressable
          onPress={() => confirm.mutate(trade.id)}
          disabled={confirm.isPending}
          style={{
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: theme.accent,
            alignItems: "center"
          }}
          accessibilityRole="button"
          accessibilityLabel="Confirmar trueque"
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Confirmar</Text>
        </Pressable>
      )}

      {trade.status === "accepted" && iConfirmed && !otherConfirmed && (
        <View>
          <Text style={{ color: theme.textMute, fontSize: 13, marginBottom: 6 }}>
            Esperás confirmación de @{counterpartyUsername}
          </Text>
          <Pressable
            onPress={() => unconfirm.mutate(trade.id)}
            disabled={unconfirm.isPending}
            style={{
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center"
            }}
            accessibilityRole="button"
            accessibilityLabel="Deshacer confirmación"
          >
            <Text style={{ color: theme.textMute, fontWeight: "600" }}>Deshacer</Text>
          </Pressable>
        </View>
      )}

      {trade.status === "completed" && (
        <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "600" }}>
          ✓ Completado · {dateLabel}
        </Text>
      )}
    </GlowCard>
  );
}

function CercaView() {
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
    <View>
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
    </View>
  );
}
