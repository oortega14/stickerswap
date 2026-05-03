import type { SQLiteBindValue } from "expo-sqlite";
import { getDb } from "./db";
import type { Sticker, StickerWithStatus } from "@/domain/types";

export async function getAllStickers(): Promise<Sticker[]> {
  const db = getDb();
  return db.getAllAsync<Sticker>(
    `SELECT code, number, name, team, section, type FROM stickers ORDER BY number`
  );
}

export async function getStickersWithStatus(filter: {
  q?: string;
  mode: "all" | "missing" | "duplicates";
}): Promise<StickerWithStatus[]> {
  const db = getDb();
  const where: string[] = [];
  const params: SQLiteBindValue[] = [];

  if (filter.q && filter.q.trim().length > 0) {
    where.push(`(s.name LIKE ? OR s.team LIKE ? OR CAST(s.number AS TEXT) LIKE ?)`);
    const like = `%${filter.q.trim()}%`;
    params.push(like, like, like);
  }
  if (filter.mode === "missing") {
    where.push(`COALESCE(ss.count, 0) = 0`);
  } else if (filter.mode === "duplicates") {
    where.push(`COALESCE(ss.count, 0) > 1`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return db.getAllAsync<StickerWithStatus>(
    `SELECT s.code, s.number, s.name, s.team, s.section, s.type,
            COALESCE(ss.count, 0) AS count
     FROM stickers s
     LEFT JOIN sticker_status ss ON ss.sticker_code = s.code
     ${whereSql}
     ORDER BY s.number`,
    params
  );
}

export async function getStickersByTeam(teamCode: string): Promise<StickerWithStatus[]> {
  const db = getDb();
  return db.getAllAsync<StickerWithStatus>(
    `SELECT s.code, s.number, s.name, s.team, s.section, s.type,
            COALESCE(ss.count, 0) AS count
     FROM stickers s
     LEFT JOIN sticker_status ss ON ss.sticker_code = s.code
     WHERE s.team = ?
     ORDER BY s.number`,
    [teamCode]
  );
}

export async function getStickerByCode(code: string): Promise<StickerWithStatus | null> {
  const db = getDb();
  return db.getFirstAsync<StickerWithStatus>(
    `SELECT s.code, s.number, s.name, s.team, s.section, s.type,
            COALESCE(ss.count, 0) AS count
     FROM stickers s
     LEFT JOIN sticker_status ss ON ss.sticker_code = s.code
     WHERE s.code = ?`,
    [code]
  );
}
