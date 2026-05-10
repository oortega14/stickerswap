import { useMutation, useQueryClient } from "@tanstack/react-query";
import { confirmTrade } from "@/social/trades";
import { useSession } from "@/auth/useSession";

export function useConfirmTrade() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (tradeId: string) => {
      if (!user) throw new Error("not_authenticated");
      return confirmTrade(tradeId, user.id);
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      if (result === "completed") {
        qc.invalidateQueries({ queryKey: ["stickers"] });
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["progress"] });
      }
    }
  });
}
