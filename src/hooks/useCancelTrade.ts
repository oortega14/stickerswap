import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelTrade } from "@/social/trades";

export function useCancelTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tradeId: string) => cancelTrade(tradeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
    }
  });
}
