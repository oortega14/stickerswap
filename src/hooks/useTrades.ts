import { useQuery } from "@tanstack/react-query";
import { fetchActiveTrades } from "@/social/trades";
import { listActiveTrades } from "@/data/trades";

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
