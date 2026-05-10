import { useMutation, useQueryClient } from "@tanstack/react-query";
import { respondTrade } from "@/social/trades";

export function useRespondTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { tradeId: string; accept: boolean }) =>
      respondTrade(input.tradeId, input.accept),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
    }
  });
}
