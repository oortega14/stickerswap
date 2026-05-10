import { supabase } from "@/auth/supabaseClient";
import { upsertTrade, listActiveTrades as listLocal } from "@/data/trades";
import type { Trade, TradeStatus } from "@/domain/types";
import { pullRemoteStatus } from "@/sync/worker";

interface RemoteRow {
  id: string;
  proposer_id: string;
  recipient_id: string;
  proposer_gives: string[];
  proposer_gets: string[];
  status: TradeStatus;
  proposer_confirmed_at: string | null;
  recipient_confirmed_at: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const parseTs = (s: string | null): number | null =>
  s === null ? null : Date.parse(s);

const remoteToTrade = (r: RemoteRow): Trade => ({
  id: r.id,
  proposerId: r.proposer_id,
  recipientId: r.recipient_id,
  proposerGives: r.proposer_gives,
  proposerGets: r.proposer_gets,
  status: r.status,
  proposerConfirmedAt: parseTs(r.proposer_confirmed_at),
  recipientConfirmedAt: parseTs(r.recipient_confirmed_at),
  message: r.message,
  createdAt: Date.parse(r.created_at),
  updatedAt: Date.parse(r.updated_at),
  completedAt: parseTs(r.completed_at)
});

export interface ProposeTradeInput {
  recipientId: string;
  proposerGives: string[];
  proposerGets: string[];
  message?: string;
}

export async function proposeTrade(input: ProposeTradeInput): Promise<Trade> {
  const { data, error } = await supabase
    .from("trades")
    .insert({
      recipient_id: input.recipientId,
      proposer_gives: input.proposerGives,
      proposer_gets: input.proposerGets,
      message: input.message ?? null
    })
    .select()
    .single();
  if (error) throw error;
  const trade = remoteToTrade(data as RemoteRow);
  await upsertTrade(trade);
  return trade;
}

export async function respondTrade(tradeId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("trade_respond", {
    p_trade: tradeId,
    p_accept: accept
  });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
}

export async function cancelTrade(tradeId: string): Promise<void> {
  const { error } = await supabase.rpc("trade_cancel", { p_trade: tradeId });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
}

export async function confirmTrade(
  tradeId: string,
  userId: string
): Promise<"completed" | "awaiting_other"> {
  const { data, error } = await supabase.rpc("trade_confirm", { p_trade: tradeId });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
  if (data === "completed") {
    await pullRemoteStatus(userId);
  }
  return (data as "completed" | "awaiting_other");
}

export async function unconfirmTrade(tradeId: string): Promise<void> {
  const { error } = await supabase.rpc("trade_unconfirm", { p_trade: tradeId });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
}

export async function fetchActiveTrades(): Promise<Trade[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [activeRes, completedRes] = await Promise.all([
    supabase.from("trades").select("*").in("status", ["pending", "accepted"]),
    supabase.from("trades").select("*").eq("status", "completed").gte("completed_at", cutoff)
  ]);

  if (activeRes.error || completedRes.error) {
    return listLocal();
  }

  const rows = ([...(activeRes.data ?? []), ...(completedRes.data ?? [])]) as RemoteRow[];
  const trades = rows.map(remoteToTrade);
  for (const t of trades) await upsertTrade(t);
  return trades;
}

async function refreshTradeFromRemote(tradeId: string): Promise<void> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("id", tradeId)
    .single();
  if (error || !data) return;
  await upsertTrade(remoteToTrade(data as RemoteRow));
}
