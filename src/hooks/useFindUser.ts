import { useMutation } from "@tanstack/react-query";
import { findUserByUsername } from "@/social/friendships";

export function useFindUser() {
  return useMutation({
    mutationFn: (uname: string) => findUserByUsername(uname)
  });
}
