import { useQuery } from "@tanstack/react-query";
import { fetchActiveTrades } from "@/social/trades";
import { listActiveTrades, listLocalTradesByStatus } from "@/data/trades";
import type { TradeStatus } from "@/domain/types";

export function useTrades() {
  return useQuery({
    queryKey: ["trades"],
    queryFn: async () => {
      try {
        return await fetchActiveTrades();
      } catch {
        return await listActiveTrades();
      }
    }
  });
}

export function useTradesByStatus(status: TradeStatus) {
  return useQuery({
    queryKey: ["trades", status],
    queryFn: () => listLocalTradesByStatus(status),
    staleTime: 5_000
  });
}
