import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposeTrade, type ProposeTradeInput } from "@/social/trades";

export function useProposeTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProposeTradeInput) => proposeTrade(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    }
  });
}
