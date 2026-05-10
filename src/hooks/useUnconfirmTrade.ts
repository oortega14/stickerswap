import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unconfirmTrade } from "@/social/trades";

export function useUnconfirmTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tradeId: string) => unconfirmTrade(tradeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
    }
  });
}
