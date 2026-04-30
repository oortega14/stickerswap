import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFriends, unfriend } from "@/social/friendships";
import { listCachedFriends } from "@/data/friendsLocal";

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      try {
        return await fetchFriends();
      } catch {
        return await listCachedFriends();
      }
    }
  });
}

export function useUnfriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendId: string) => unfriend(friendId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] })
  });
}
