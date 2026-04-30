import { useQuery } from "@tanstack/react-query";
import { countPending } from "@/data/syncQueue";

export function usePendingCount() {
  return useQuery({
    queryKey: ["sync", "pending"],
    queryFn: () => countPending(),
    refetchInterval: 5_000
  });
}
