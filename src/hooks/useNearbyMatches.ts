import { useQuery } from "@tanstack/react-query";
import { fetchNearbyMatches } from "@/social/nearbyMatches";
import { rankNearbyMatches } from "@/domain/nearbyScore";

export function useNearbyMatches() {
  return useQuery({
    queryKey: ["nearbyMatches"],
    queryFn: async () => {
      const raw = await fetchNearbyMatches();
      return rankNearbyMatches(raw);
    },
    staleTime: 60_000
  });
}
