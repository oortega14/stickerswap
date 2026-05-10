import type { Trade, TradeStatus, TradeRole, TradeEvent, TradeCta } from "./types";

const COMPLETED_BANNER_MS = 24 * 60 * 60 * 1000;

export function nextStatus(
  current: TradeStatus,
  event: TradeEvent
): TradeStatus | "invalid" {
  if (current === "pending" && event === "accept") return "accepted";
  if (current === "pending" && event === "decline") return "declined";
  if (current === "pending" && event === "cancel") return "cancelled";
  // confirm/unconfirm en accepted no transicionan acá: el status final
  // (completed) lo decide la RPC viendo ambos timestamps.
  if (current === "accepted" && event === "confirm") return "accepted";
  if (current === "accepted" && event === "unconfirm") return "accepted";
  return "invalid";
}

export function ctaFor(
  role: TradeRole,
  trade: Trade,
  now: number = Date.now()
): TradeCta {
  if (trade.status === "declined" || trade.status === "cancelled") {
    return { kind: "none", label: "" };
  }

  if (trade.status === "completed") {
    if (trade.completedAt && now - trade.completedAt < COMPLETED_BANNER_MS) {
      return { kind: "completed", label: "Cambio completado ✓" };
    }
    return { kind: "none", label: "" };
  }

  if (trade.status === "pending") {
    if (role === "proposer") {
      return {
        kind: "waiting",
        label: "Esperando respuesta",
        secondaryAction: "cancel"
      };
    }
    return {
      kind: "respond",
      label: "Te propusieron un cambio",
      primaryAction: "accept",
      secondaryAction: "decline"
    };
  }

  // accepted
  const myMark =
    role === "proposer" ? trade.proposerConfirmedAt : trade.recipientConfirmedAt;
  const otherMark =
    role === "proposer" ? trade.recipientConfirmedAt : trade.proposerConfirmedAt;

  if (!myMark && !otherMark) {
    return { kind: "mark_done", label: "Marcar como hecho", primaryAction: "confirm" };
  }
  if (myMark && !otherMark) {
    return {
      kind: "awaiting_other",
      label: "Esperando que confirme",
      secondaryAction: "unconfirm"
    };
  }
  if (!myMark && otherMark) {
    return { kind: "confirm", label: "Confirmar", primaryAction: "confirm" };
  }
  // both marked → la RPC ya transicionó a 'completed'; defensivo:
  return { kind: "completed", label: "Cambio completado ✓" };
}
