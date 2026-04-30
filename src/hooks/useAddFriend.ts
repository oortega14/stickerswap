import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addFriendByCode } from "@/social/friendships";

export function useAddFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => addFriendByCode(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    }
  });
}
