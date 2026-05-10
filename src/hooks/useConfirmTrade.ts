import { useMutation, useQueryClient } from "@tanstack/react-query";
import { confirmTrade } from "@/social/trades";

export function useConfirmTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tradeId: string) => confirmTrade(tradeId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      if (result === "completed") {
        qc.invalidateQueries({ queryKey: ["stickers"] });
        qc.invalidateQueries({ queryKey: ["matches"] });
      }
    }
  });
}
