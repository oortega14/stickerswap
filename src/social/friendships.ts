import { supabase } from "@/auth/supabaseClient";
import { cacheFriends, cacheBidirectionalMatches } from "@/data/friendsLocal";
import { markScanned } from "@/social/recentScans";
import type { Friend, FriendMatch } from "@/domain/types";
import type { BidirectionalMatchPayload } from "@/domain/friendMatchBuilder";

export interface AddFriendResult {
  id: string;
  username: string;
}

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
  const meId = (await supabase.auth.getSession()).data.session?.user?.id;
  if (!meId) throw new Error("not_authenticated");
  const { data, error } = await supabase
    .from("friendships")
    .select(`
      friend_id, status, source, created_at,
      profiles:friend_id (id, username, display_name, avatar_url)
    `)
    .eq("status", "accepted")
    .eq("user_id", meId);
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

export async function addFriendByCode(code: string): Promise<AddFriendResult> {
  const { data, error } = await supabase.rpc("accept_invite_code", { code });
  if (error) throw error;
  const targetId = data as string;
  // Marcar inmediatamente (sincrónico, antes de cualquier await) para suprimir
  // el snackbar "te escanearon" que va a llegar por realtime para nuestro propio
  // scan. Microtasks drenan antes de eventos macrotask de realtime.
  markScanned(targetId);

  const friends = await fetchFriends();
  const found = friends.find((f) => f.id === targetId);
  if (found) return { id: targetId, username: found.username };

  // Fallback: si por algún motivo no quedó en el listado (RLS, cache),
  // resolvemos el username directo contra profiles.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", targetId)
    .maybeSingle();
  return { id: targetId, username: (profile?.username as string) ?? "" };
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

export async function fetchMatches(): Promise<BidirectionalMatchPayload> {
  const { data, error } = await supabase
    .from("v_friend_matches_bidirectional")
    .select("friend_id, sticker_code, extras, direction");
  if (error) throw error;

  const theyHaveYouNeed: FriendMatch[] = [];
  const youHaveTheyNeed: FriendMatch[] = [];
  for (const r of data ?? []) {
    const m: FriendMatch = {
      friendId: r.friend_id as string,
      stickerCode: r.sticker_code as string,
      extras: r.extras as number
    };
    if (r.direction === "they_have_you_need") theyHaveYouNeed.push(m);
    else youHaveTheyNeed.push(m);
  }

  // Recachear local
  const grouped = new Map<string, { they: FriendMatch[]; you: FriendMatch[] }>();
  for (const m of theyHaveYouNeed) {
    const e = grouped.get(m.friendId) ?? { they: [], you: [] };
    e.they.push(m);
    grouped.set(m.friendId, e);
  }
  for (const m of youHaveTheyNeed) {
    const e = grouped.get(m.friendId) ?? { they: [], you: [] };
    e.you.push(m);
    grouped.set(m.friendId, e);
  }
  for (const [fid, { they, you }] of grouped) {
    await cacheBidirectionalMatches(fid, they, you);
  }

  return { theyHaveYouNeed, youHaveTheyNeed };
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
