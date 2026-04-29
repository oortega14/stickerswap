import { getDb } from "./db";
import type { StickerStatus } from "@/domain/types";

interface Row {
  sticker_code: string;
  count: number;
  updated_at: number;
}

function rowToStatus(r: Row): StickerStatus {
  return { stickerCode: r.sticker_code, count: r.count, updatedAt: r.updated_at };
}

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

export async function incrementStatus(code: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sticker_status (sticker_code, count, updated_at) VALUES (?, 1, ?)
     ON CONFLICT(sticker_code) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
    [code, now]
  );
}

export async function decrementStatus(code: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sticker_status (sticker_code, count, updated_at) VALUES (?, 0, ?)
     ON CONFLICT(sticker_code) DO UPDATE
       SET count = MAX(count - 1, 0), updated_at = excluded.updated_at`,
    [code, now]
  );
}
