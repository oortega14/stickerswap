import { getDb } from "./db";
import type { Trade, TradeStatus } from "@/domain/types";

interface Row {
  id: string;
  proposer_id: string;
  recipient_id: string;
  proposer_gives: string;       // JSON array
  proposer_gets: string;        // JSON array
  status: TradeStatus;
  proposer_confirmed_at: number | null;
  recipient_confirmed_at: number | null;
  message: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

const rowToTrade = (r: Row): Trade => ({
  id: r.id,
  proposerId: r.proposer_id,
  recipientId: r.recipient_id,
  proposerGives: JSON.parse(r.proposer_gives) as string[],
  proposerGets: JSON.parse(r.proposer_gets) as string[],
  status: r.status,
  proposerConfirmedAt: r.proposer_confirmed_at,
  recipientConfirmedAt: r.recipient_confirmed_at,
  message: r.message,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  completedAt: r.completed_at
});

export async function upsertTrade(trade: Trade): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO trades_cache (
       id, proposer_id, recipient_id, proposer_gives, proposer_gets,
       status, proposer_confirmed_at, recipient_confirmed_at, message,
       created_at, updated_at, completed_at, fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       proposer_id = excluded.proposer_id,
       recipient_id = excluded.recipient_id,
       proposer_gives = excluded.proposer_gives,
       proposer_gets = excluded.proposer_gets,
       status = excluded.status,
       proposer_confirmed_at = excluded.proposer_confirmed_at,
       recipient_confirmed_at = excluded.recipient_confirmed_at,
       message = excluded.message,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       completed_at = excluded.completed_at,
       fetched_at = excluded.fetched_at`,
    [
      trade.id,
      trade.proposerId,
      trade.recipientId,
      JSON.stringify(trade.proposerGives),
      JSON.stringify(trade.proposerGets),
      trade.status,
      trade.proposerConfirmedAt,
      trade.recipientConfirmedAt,
      trade.message,
      trade.createdAt,
      trade.updatedAt,
      trade.completedAt,
      now
    ]
  );
}

export async function getTradeById(id: string): Promise<Trade | null> {
  const db = getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT id, proposer_id, recipient_id, proposer_gives, proposer_gets,
            status, proposer_confirmed_at, recipient_confirmed_at, message,
            created_at, updated_at, completed_at
       FROM trades_cache WHERE id = ?`,
    [id]
  );
  return row ? rowToTrade(row) : null;
}

export async function listActiveTrades(): Promise<Trade[]> {
  const db = getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT id, proposer_id, recipient_id, proposer_gives, proposer_gets,
            status, proposer_confirmed_at, recipient_confirmed_at, message,
            created_at, updated_at, completed_at
       FROM trades_cache WHERE status IN ('pending', 'accepted')
       ORDER BY updated_at DESC`
  );
  return rows.map(rowToTrade);
}

export async function getActiveTradeForFriend(
  meId: string,
  friendId: string
): Promise<Trade | null> {
  const db = getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT id, proposer_id, recipient_id, proposer_gives, proposer_gets,
            status, proposer_confirmed_at, recipient_confirmed_at, message,
            created_at, updated_at, completed_at
       FROM trades_cache
      WHERE status IN ('pending', 'accepted')
        AND ((proposer_id = ? AND recipient_id = ?)
          OR (proposer_id = ? AND recipient_id = ?))
      ORDER BY updated_at DESC LIMIT 1`,
    [meId, friendId, friendId, meId]
  );
  return row ? rowToTrade(row) : null;
}

export async function removeTrade(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM trades_cache WHERE id = ?`, [id]);
}
