import { supabase } from "@/auth/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

type OnFriendUpdate = () => void;

export function subscribeToFriendUpdates(onUpdate: OnFriendUpdate): RealtimeChannel {
  // postgres_changes sobre sticker_status. RLS filtra automáticamente lo que recibimos.
  const channel = supabase
    .channel("friend_updates")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sticker_status" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "sticker_status" },
      () => onUpdate()
    )
    .subscribe();
  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
