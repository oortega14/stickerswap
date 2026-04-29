// Mock mínimo de expo-sqlite usando better-sqlite3 puro de node.
// Solo exponemos la superficie que usa nuestro código: openDatabaseSync,
// execAsync, runAsync, getAllAsync, getFirstAsync.
//
// Uso desde un test:
//   jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());
//   import "../setup-sqlite-mock"; // registra el afterEach que resetea las DBs

export function createSqliteMock() {
  const Database = require("better-sqlite3");
  const databases = new Map<string, any>();

  function open(name: string) {
    let db = databases.get(name);
    if (!db) {
      db = new Database(":memory:");
      databases.set(name, db);
    }

    return {
      execAsync: async (sql: string) => {
        db.exec(sql);
      },
      runAsync: async (sql: string, params: unknown[] = []) => {
        const stmt = db.prepare(sql);
        return stmt.run(...(params as never[]));
      },
      getAllAsync: async <T>(sql: string, params: unknown[] = []) => {
        const stmt = db.prepare(sql);
        return stmt.all(...(params as never[])) as T[];
      },
      getFirstAsync: async <T>(sql: string, params: unknown[] = []) => {
        const stmt = db.prepare(sql);
        return (stmt.get(...(params as never[])) ?? null) as T | null;
      }
    };
  }

  return {
    openDatabaseSync: open,
    __reset: () => {
      for (const [, db] of databases) db.close();
      databases.clear();
    }
  };
}

afterEach(() => {
  const sqlite = require("expo-sqlite") as { __reset?: () => void };
  if (typeof sqlite.__reset === "function") sqlite.__reset();
});
