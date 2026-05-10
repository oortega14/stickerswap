import { supabase } from "@/auth/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeCallbacks {
  onStickerStatusChange: () => void;
  onFriendshipChange: () => void;
  onTradeChange: (payload: { eventType: string; new: any; old: any }) => void;
}

export function subscribeToFriendUpdates(cb: RealtimeCallbacks): RealtimeChannel {
  const channel = supabase
    .channel("friend_updates")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sticker_status" },
      () => cb.onStickerStatusChange()
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "sticker_status" },
      () => cb.onStickerStatusChange()
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "friendships" },
      () => cb.onFriendshipChange()
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "friendships" },
      () => cb.onFriendshipChange()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trades" },
      (payload) => cb.onTradeChange(payload as any)
    )
    .subscribe();
  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
