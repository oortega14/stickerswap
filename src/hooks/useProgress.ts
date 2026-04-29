import { useQuery } from "@tanstack/react-query";
import { getAllStickers } from "@/data/stickers";
import { listStatuses } from "@/data/stickerStatus";
import { computeProgress } from "@/domain/progress";

export function useProgress() {
  return useQuery({
    queryKey: ["stickers", "progress"],
    queryFn: async () => {
      const [stickers, statuses] = await Promise.all([getAllStickers(), listStatuses()]);
      return computeProgress(stickers, statuses);
    }
  });
}
