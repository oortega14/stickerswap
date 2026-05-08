import { getDb } from "./db";
import { enqueue } from "./syncQueue";
import type { StickerStatus } from "@/domain/types";

interface Row {
  sticker_code: string;
  count: number;
  updated_at: number;
}

const rowToStatus = (r: Row): StickerStatus => ({
  stickerCode: r.sticker_code,
  count: r.count,
  updatedAt: r.updated_at
});

export async function getStatus(code: string): Promise<StickerStatus | null> {
  const db = getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT sticker_code, count, updated_at FROM sticker_status WHERE sticker_code = ?`,
    [code]
  );
  return row ? rowToStatus(row) : null;
}

export async function listStatuses(): Promise<StickerStatus[]> {
  const db = getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT sticker_code, count, updated_at FROM sticker_status`
  );
  return rows.map(rowToStatus);
}

async function nextCount(code: string, delta: 1 | -1): Promise<number> {
  const current = await getStatus(code);
  const base = current?.count ?? 0;
  return Math.max(0, base + delta);
}

export async function incrementStatus(code: string): Promise<void> {
  const db = getDb();
  const newCount = await nextCount(code, 1);
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sticker_status (sticker_code, count, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(sticker_code) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at`,
    [code, newCount, now]
  );
  await enqueue(code, newCount);
}

export async function decrementStatus(code: string): Promise<void> {
  const db = getDb();
  const newCount = await nextCount(code, -1);
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sticker_status (sticker_code, count, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(sticker_code) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at`,
    [code, newCount, now]
  );
  await enqueue(code, newCount);
}

export async function bulkSetOwnedForTeam(teamCode: string): Promise<number> {
  const db = getDb();
  // Cromos del equipo donde no hay row o count = 0
  const rows = await db.getAllAsync<{ code: string }>(
    `SELECT s.code FROM stickers s
     LEFT JOIN sticker_status ss ON ss.sticker_code = s.code
     WHERE s.team = ? AND (ss.count IS NULL OR ss.count = 0)`,
    [teamCode]
  );
  if (rows.length === 0) return 0;

  const now = Date.now();
  await db.execAsync("BEGIN TRANSACTION");
  try {
    for (const { code } of rows) {
      await db.runAsync(
        `INSERT INTO sticker_status (sticker_code, count, updated_at) VALUES (?, 1, ?)
         ON CONFLICT(sticker_code) DO UPDATE SET count = 1, updated_at = excluded.updated_at`,
        [code, now]
      );
      await enqueue(code, 1);
    }
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
  return rows.length;
}

// Aplicado por el sync worker — NO encola.
export async function applyRemoteStatus(
  code: string,
  count: number,
  updatedAt: number
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO sticker_status (sticker_code, count, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(sticker_code) DO UPDATE
       SET count = excluded.count, updated_at = excluded.updated_at
       WHERE sticker_status.updated_at <= excluded.updated_at`,
    [code, count, updatedAt]
  );
}
