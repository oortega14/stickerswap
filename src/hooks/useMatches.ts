import { useQuery } from "@tanstack/react-query";
import { fetchMatches } from "@/social/friendships";
import { listAllCachedBidirectionalMatches } from "@/data/friendsLocal";
import { summarizeMatches } from "@/domain/friendMatchBuilder";
import { useFriends } from "./useFriends";

export function useMatches() {
  const friends = useFriends();
  const matches = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      try {
        return await fetchMatches();
      } catch {
        return await listAllCachedBidirectionalMatches();
      }
    }
  });

  const summary =
    friends.data && matches.data
      ? summarizeMatches(
          matches.data,
          new Map(
            friends.data.map((f) => [
              f.id,
              { username: f.username, displayName: f.displayName }
            ])
          )
        )
      : [];

  return { ...matches, summary };
}
