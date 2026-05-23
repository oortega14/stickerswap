import { getDb } from "./db";
import type { Sticker } from "@/domain/types";

export interface StickerDataset {
  version: number;
  album: string;
  stickers: Sticker[];
}

export async function getInstalledDatasetVersion(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'dataset_version'`
  );
  return row ? parseInt(row.value, 10) : 0;
}

export async function seedStickers(dataset: StickerDataset): Promise<void> {
  const db = getDb();
  const installed = await getInstalledDatasetVersion();
  if (installed >= dataset.version) return;

  await db.execAsync("BEGIN TRANSACTION");
  try {
    await db.execAsync(`DELETE FROM stickers`);
    for (const s of dataset.stickers) {
      await db.runAsync(
        `INSERT INTO stickers (code, number, team, section, type) VALUES (?, ?, ?, ?, ?)`,
        [s.code, s.number, s.team, s.section, s.type]
      );
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('dataset_version', ?)`,
      [String(dataset.version)]
    );
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
}
