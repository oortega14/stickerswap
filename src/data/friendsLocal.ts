import { getDb } from "./db";
import type { Friend, FriendMatch, FriendshipStatus, FriendshipSource } from "@/domain/types";

interface FriendRow {
  friend_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: FriendshipStatus;
  source: FriendshipSource;
  created_at: number;
}

const toFriend = (r: FriendRow): Friend => ({
  id: r.friend_id,
  username: r.username,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  status: r.status,
  source: r.source,
  createdAt: r.created_at
});

export async function cacheFriends(friends: Friend[]): Promise<void> {
  const db = getDb();
  const now = Date.now();
  for (const f of friends) {
    await db.runAsync(
      `INSERT INTO friends_cache (friend_id, username, display_name, avatar_url, status, source, created_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(friend_id) DO UPDATE SET
         username = excluded.username,
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url,
         status = excluded.status,
         source = excluded.source,
         created_at = excluded.created_at,
         fetched_at = excluded.fetched_at`,
      [f.id, f.username, f.displayName, f.avatarUrl, f.status, f.source, f.createdAt, now]
    );
  }
}

export async function listCachedFriends(): Promise<Friend[]> {
  const db = getDb();
  const rows = await db.getAllAsync<FriendRow>(
    `SELECT friend_id, username, display_name, avatar_url, status, source, created_at FROM friends_cache ORDER BY username`
  );
  return rows.map(toFriend);
}

export async function getCachedFriend(friendId: string): Promise<Friend | null> {
  const db = getDb();
  const row = await db.getFirstAsync<FriendRow>(
    `SELECT friend_id, username, display_name, avatar_url, status, source, created_at FROM friends_cache WHERE friend_id = ?`,
    [friendId]
  );
  return row ? toFriend(row) : null;
}

export async function cacheMatches(friendId: string, matches: FriendMatch[]): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.runAsync(`DELETE FROM friend_matches_cache WHERE friend_id = ?`, [friendId]);
  for (const m of matches) {
    await db.runAsync(
      `INSERT INTO friend_matches_cache (friend_id, sticker_code, extras, fetched_at)
       VALUES (?, ?, ?, ?)`,
      [m.friendId, m.stickerCode, m.extras, now]
    );
  }
}

export async function listCachedMatchesForFriend(friendId: string): Promise<FriendMatch[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ friend_id: string; sticker_code: string; extras: number }>(
    `SELECT friend_id, sticker_code, extras FROM friend_matches_cache WHERE friend_id = ?`,
    [friendId]
  );
  return rows.map((r) => ({ friendId: r.friend_id, stickerCode: r.sticker_code, extras: r.extras }));
}

export async function listAllCachedMatches(): Promise<FriendMatch[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ friend_id: string; sticker_code: string; extras: number }>(
    `SELECT friend_id, sticker_code, extras FROM friend_matches_cache`
  );
  return rows.map((r) => ({ friendId: r.friend_id, stickerCode: r.sticker_code, extras: r.extras }));
}

export async function removeFriend(friendId: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM friends_cache WHERE friend_id = ?`, [friendId]);
  await db.runAsync(`DELETE FROM friend_matches_cache WHERE friend_id = ?`, [friendId]);
}
