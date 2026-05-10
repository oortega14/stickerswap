import { useTrades } from "./useTrades";
import { useSession } from "@/auth/useSession";
import type { Trade } from "@/domain/types";

export function useTradeForFriend(friendId: string): Trade | null {
  const { user } = useSession();
  const { data } = useTrades();
  if (!user || !data) return null;
  const trade = data.find(
    (t) =>
      (t.proposerId === user.id && t.recipientId === friendId) ||
      (t.proposerId === friendId && t.recipientId === user.id)
  );
  return trade ?? null;
}
