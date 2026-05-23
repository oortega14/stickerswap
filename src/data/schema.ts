import { getDb } from "./db";

const SCHEMA_VERSION = 5;

export async function initSchema(): Promise<void> {
  const db = getDb();

  // Garantiza meta para poder consultar schema_version antes de tocar stickers.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migracion v4 → v5: la tabla stickers ya no tiene columna `name`.
  // SQLite no soporta DROP COLUMN portable, asi que recreamos la tabla si
  // venimos de un schema viejo.
  const currentVersion = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'schema_version'`
  );
  const v = currentVersion ? parseInt(currentVersion.value, 10) : 0;
  if (v > 0 && v < 5) {
    await db.execAsync(`DROP TABLE IF EXISTS stickers`);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS stickers (
      code TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
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

    CREATE TABLE IF NOT EXISTS friends_cache (
      friend_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friend_matches_cache (
      friend_id TEXT NOT NULL,
      sticker_code TEXT NOT NULL,
      extras INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (friend_id, sticker_code)
    );

    -- Cache local de trades. Espejo de la tabla remota; refresca con
    -- pull al boot y on realtime. No hay queue local — los trades requieren
    -- respuesta del backend (RPCs) y no se encolan offline.
    CREATE TABLE IF NOT EXISTS trades_cache (
      id TEXT PRIMARY KEY,
      proposer_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      proposer_gives TEXT NOT NULL,
      proposer_gets TEXT NOT NULL,
      status TEXT NOT NULL,
      proposer_confirmed_at INTEGER,
      recipient_confirmed_at INTEGER,
      message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      fetched_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_trades_cache_proposer ON trades_cache(proposer_id, status);
    CREATE INDEX IF NOT EXISTS idx_trades_cache_recipient ON trades_cache(recipient_id, status);

    -- Bidirectional matches: ambos lados con campo direction. Reemplaza
    -- gradualmente a friend_matches_cache (vieja) — la dejamos viva por
    -- compat hasta que ningún consumidor la lea.
    CREATE TABLE IF NOT EXISTS friend_matches_bidi_cache (
      friend_id TEXT NOT NULL,
      sticker_code TEXT NOT NULL,
      extras INTEGER NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('they_have_you_need', 'you_have_they_need')),
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (friend_id, sticker_code, direction)
    );

    CREATE INDEX IF NOT EXISTS idx_fm_bidi_friend ON friend_matches_bidi_cache(friend_id);
  `);

  await db.runAsync(
    `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`,
    [String(SCHEMA_VERSION)]
  );
}
