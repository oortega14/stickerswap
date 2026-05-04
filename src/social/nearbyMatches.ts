import { supabase } from "@/auth/supabaseClient";
import type { NearbyMatchRaw, PendingRequest, FriendshipSource } from "@/domain/types";

interface NearbyRow {
  me_id: string;
  them_id: string;
  username: string;
  display_name: string | null;
  city_label: string;
  they_have_i_need: number;
  i_have_they_need: number;
}

interface PendingRow {
  requester_id: string;
  username: string;
  display_name: string | null;
  city_label: string | null;
  message: string | null;
  source: FriendshipSource;
  created_at: string;
}

export function mapNearbyRow(r: NearbyRow): NearbyMatchRaw {
  return {
    themId: r.them_id,
    username: r.username,
    displayName: r.display_name,
    cityLabel: r.city_label,
    theyHaveINeed: r.they_have_i_need,
    iHaveTheyNeed: r.i_have_they_need
  };
}

export function mapPendingRow(r: PendingRow): PendingRequest {
  return {
    requesterId: r.requester_id,
    username: r.username,
    displayName: r.display_name,
    cityLabel: r.city_label,
    message: r.message,
    source: r.source,
    createdAt: Date.parse(r.created_at)
  };
}

export async function fetchNearbyMatches(): Promise<NearbyMatchRaw[]> {
  const { data, error } = await supabase
    .from("v_nearby_matches")
    .select("me_id, them_id, username, display_name, city_label, they_have_i_need, i_have_they_need");
  if (error) throw error;
  return (data ?? []).map(mapNearbyRow);
}

export async function fetchPendingRequests(): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from("v_pending_incoming_requests")
    .select("requester_id, username, display_name, city_label, message, source, created_at");
  if (error) throw error;
  return (data ?? []).map(mapPendingRow);
}

export async function requestNearbyTrade(targetId: string, message: string | null): Promise<void> {
  const { error } = await supabase.rpc("request_nearby_trade", { target_id: targetId, msg: message });
  if (error) throw error;
}

export async function acceptFriendRequest(requesterId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_friend_request", { requester_id: requesterId });
  if (error) throw error;
}

export async function declineFriendRequest(requesterId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_friend_request", { requester_id: requesterId });
  if (error) throw error;
}
