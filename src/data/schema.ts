import { getDb } from "./db";

const SCHEMA_VERSION = 2;

export async function initSchema(): Promise<void> {
  const db = getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stickers (
      code TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      team TEXT,
      section TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stickers_section ON stickers(section);
    CREATE INDEX IF NOT EXISTS idx_stickers_number ON stickers(number);

    CREATE TABLE IF NOT EXISTS sticker_status (
      sticker_code TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (sticker_code) REFERENCES stickers(code) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sticker_code TEXT NOT NULL,
      count INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_attempts ON sync_queue(attempts);
  `);

  await db.runAsync(
    `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`,
    [String(SCHEMA_VERSION)]
  );
}
