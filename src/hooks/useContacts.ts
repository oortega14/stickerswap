import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchUserContacts, updateMyContacts, type UserContacts } from "@/social/contacts";
import { useSession } from "@/auth/useSession";

export function useMyContacts() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["contacts", "me", user?.id],
    queryFn: () => (user ? fetchUserContacts(user.id) : null),
    enabled: !!user,
    staleTime: 60_000
  });
}

export function useFriendContacts(friendId: string | null | undefined) {
  return useQuery({
    queryKey: ["contacts", "friend", friendId],
    queryFn: () => (friendId ? fetchUserContacts(friendId) : null),
    enabled: !!friendId,
    staleTime: 60_000
  });
}

export function useUpdateMyContacts() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (c: UserContacts) => {
      if (!user) throw new Error("not authenticated");
      return updateMyContacts(user.id, c);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", "me", user?.id] });
    }
  });
}
