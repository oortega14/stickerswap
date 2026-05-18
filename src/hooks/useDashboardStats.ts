import { useMemo } from "react";
import { useAlbumStickers } from "./useStickers";
import { useFriends } from "./useFriends";
import { useMatches } from "./useMatches";
import { computeStats, type DashboardStats } from "@/domain/stats";

interface Result {
  isLoading: boolean;
  stats: DashboardStats | null;
}

export function useDashboardStats(): Result {
  const stickers = useAlbumStickers();
  const friends = useFriends();
  const matches = useMatches();

  return useMemo(() => {
    if (!stickers.data || !friends.data) {
      return { isLoading: true, stats: null };
    }
    const flat = stickers.data.flatMap((section) => section.stickers);
    const stats = computeStats(flat, friends.data, matches.summary ?? []);
    return { isLoading: false, stats };
  }, [stickers.data, friends.data, matches.summary]);
}
