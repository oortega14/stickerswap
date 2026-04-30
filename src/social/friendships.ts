import { supabase } from "@/auth/supabaseClient";
import { cacheFriends, cacheMatches } from "@/data/friendsLocal";
import type { Friend, FriendMatch } from "@/domain/types";

interface FriendshipRow {
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
  source: "qr_code" | "username_search";
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export async function fetchFriends(): Promise<Friend[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select(`
      friend_id, status, source, created_at,
      profiles:friend_id (id, username, display_name, avatar_url)
    `)
    .eq("status", "accepted");
  if (error) throw error;

  const friends: Friend[] = (data ?? []).map((r: unknown) => {
    const row = r as FriendshipRow;
    return {
      id: row.profiles.id,
      username: row.profiles.username,
      displayName: row.profiles.display_name,
      avatarUrl: row.profiles.avatar_url,
      status: row.status,
      source: row.source,
      createdAt: Date.parse(row.created_at)
    };
  });

  await cacheFriends(friends);
  return friends;
}

export async function addFriendByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_invite_code", { code });
  if (error) throw error;
  await fetchFriends();
  return data as string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export async function findUserByUsername(uname: string): Promise<UserSearchResult | null> {
  const { data, error } = await supabase.rpc("find_user_by_username", { uname });
  if (error) throw error;
  const rows = data as UserSearchResult[];
  return rows.length > 0 ? rows[0] : null;
}

export async function requestFriendByUsername(targetId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .insert({ friend_id: targetId, status: "pending", source: "username_search" });
  if (error) throw error;
}

export async function fetchMatches(): Promise<FriendMatch[]> {
  const { data, error } = await supabase
    .from("v_friend_matches")
    .select("friend_id, sticker_code, extras");
  if (error) throw error;
  const matches = (data ?? []).map((r) => ({
    friendId: r.friend_id as string,
    stickerCode: r.sticker_code as string,
    extras: r.extras as number
  }));

  // Recachear local agrupando por friend_id
  const grouped = new Map<string, FriendMatch[]>();
  for (const m of matches) {
    const arr = grouped.get(m.friendId) ?? [];
    arr.push(m);
    grouped.set(m.friendId, arr);
  }
  for (const [fid, ms] of grouped) await cacheMatches(fid, ms);

  return matches;
}

export async function unfriend(friendId: string): Promise<void> {
  // Borra ambas filas (la mía y la del otro lado se cae por RLS — a veces hay que llamar RPC).
  // Para simplificar: borramos solo la mía; la fila contraria queda huérfana hasta que ese usuario la borre.
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("friend_id", friendId);
  if (error) throw error;
}
