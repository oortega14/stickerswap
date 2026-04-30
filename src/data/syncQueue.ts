import { getDb } from "./db";

export interface QueueRow {
  id: number;
  stickerCode: string;
  count: number;
  ts: number;
  attempts: number;
}

interface RawRow {
  id: number;
  sticker_code: string;
  count: number;
  ts: number;
  attempts: number;
}

const map = (r: RawRow): QueueRow => ({
  id: r.id,
  stickerCode: r.sticker_code,
  count: r.count,
  ts: r.ts,
  attempts: r.attempts
});

export async function enqueue(stickerCode: string, count: number): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO sync_queue (sticker_code, count, ts, attempts) VALUES (?, ?, ?, 0)`,
    [stickerCode, count, Date.now()]
  );
}

export async function peekBatch(limit: number): Promise<QueueRow[]> {
  const db = getDb();
  const rows = await db.getAllAsync<RawRow>(
    `SELECT id, sticker_code, count, ts, attempts FROM sync_queue ORDER BY id LIMIT ?`,
    [limit]
  );
  return rows.map(map);
}

export async function removeIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(`DELETE FROM sync_queue WHERE id IN (${placeholders})`, ids);
}

export async function bumpAttempts(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `UPDATE sync_queue SET attempts = attempts + 1 WHERE id IN (${placeholders})`,
    ids
  );
}

export async function countPending(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM sync_queue`);
  return row?.n ?? 0;
}

export async function countStuck(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sync_queue WHERE attempts >= 10`
  );
  return row?.n ?? 0;
}
