import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposeTrade, proposeTradeCombo, type ProposeTradeInput } from "@/social/trades";
import { findFriendshipStatusByUserId } from "@/social/friendships";
import { pickProposeRpc } from "@/domain/tradeRpcSelector";

export function useProposeTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProposeTradeInput) => {
      const friendship = await findFriendshipStatusByUserId(input.recipientId);
      const rpc = pickProposeRpc(friendship);
      if (rpc === "insert") {
        const trade = await proposeTrade(input);
        return trade.id;
      }
      return proposeTradeCombo(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["outgoingRequests"] });
    }
  });
}
