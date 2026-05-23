import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync("stickerswap.db");
  }
  return _db;
}

// Solo para tests
export function _resetDb() {
  _db = null;
}
