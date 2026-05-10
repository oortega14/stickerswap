import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { ctaFor } from "@/domain/tradeStateMachine";
import { useRespondTrade } from "@/hooks/useRespondTrade";
import { useCancelTrade } from "@/hooks/useCancelTrade";
import { useConfirmTrade } from "@/hooks/useConfirmTrade";
import { useUnconfirmTrade } from "@/hooks/useUnconfirmTrade";
import { useSession } from "@/auth/useSession";
import { haptics } from "@/lib/haptics";
import type { Trade, TradeRole } from "@/domain/types";

interface Props {
  trade: Trade;
}

export function ActiveTradeBanner({ trade }: Props) {
  const { theme } = useTheme();
  const { user } = useSession();
  const respond = useRespondTrade();
  const cancel = useCancelTrade();
  const confirm = useConfirmTrade();
  const unconfirm = useUnconfirmTrade();

  if (!user) return null;
  const role: TradeRole = user.id === trade.proposerId ? "proposer" : "recipient";
  const cta = ctaFor(role, trade);

  if (cta.kind === "none") return null;

  const busy =
    respond.isPending || cancel.isPending || confirm.isPending || unconfirm.isPending;

  const onPrimary = async () => {
    if (busy) return;
    await haptics.medium();
    if (cta.primaryAction === "accept") respond.mutate({ tradeId: trade.id, accept: true });
    if (cta.primaryAction === "confirm") confirm.mutate(trade.id);
  };

  const onSecondary = async () => {
    if (busy) return;
    await haptics.light();
    if (cta.secondaryAction === "decline") respond.mutate({ tradeId: trade.id, accept: false });
    if (cta.secondaryAction === "cancel") cancel.mutate(trade.id);
    if (cta.secondaryAction === "unconfirm") unconfirm.mutate(trade.id);
  };

  const isCompleted = cta.kind === "completed";

  return (
    <View
      style={{
        backgroundColor: isCompleted ? "#dcfce7" : theme.card,
        borderColor: isCompleted ? "#86efac" : theme.border,
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12
      }}
    >
      <Text
        style={{
          color: isCompleted ? "#166534" : theme.textMute,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1,
          marginBottom: 6
        }}
      >
        {isCompleted ? "CAMBIO COMPLETADO" : "CAMBIO ACTIVO"}
      </Text>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
        {cta.label}
      </Text>
      <Text style={{ color: theme.textMute, fontSize: 12, marginBottom: 10 }}>
        {trade.proposerGets.length} ↔ {trade.proposerGives.length}
      </Text>

      {(cta.primaryAction || cta.secondaryAction) && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {cta.primaryAction && (
            <Pressable
              onPress={onPrimary}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: theme.accent,
                alignItems: "center",
                opacity: busy ? 0.6 : 1
              }}
              accessibilityRole="button"
              accessibilityLabel={cta.label}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {cta.primaryAction === "accept" ? "Aceptar" : "Confirmar"}
                </Text>
              )}
            </Pressable>
          )}
          {cta.secondaryAction && (
            <Pressable
              onPress={onSecondary}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.border,
                alignItems: "center",
                opacity: busy ? 0.6 : 1
              }}
              accessibilityRole="button"
              accessibilityLabel={
                cta.secondaryAction === "cancel"
                  ? "Cancelar"
                  : cta.secondaryAction === "decline"
                    ? "Rechazar"
                    : "Deshacer"
              }
            >
              <Text style={{ color: theme.textMute, fontWeight: "700" }}>
                {cta.secondaryAction === "cancel"
                  ? "Cancelar"
                  : cta.secondaryAction === "decline"
                    ? "Rechazar"
                    : "Deshacer"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
