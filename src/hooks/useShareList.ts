import { useQuery } from "@tanstack/react-query";
import { getAllStickers } from "@/data/stickers";
import { listStatuses } from "@/data/stickerStatus";
import { buildTradeList } from "@/domain/tradeList";

export function useShareList() {
  // Key bajo ["stickers", ...] para que se invalide automaticamente cuando
  // useIncrement/useDecrement hagan invalidateQueries({ queryKey: ["stickers"] }).
  const query = useQuery({
    queryKey: ["stickers", "shareList"],
    queryFn: async () => {
      const [stickers, statuses] = await Promise.all([getAllStickers(), listStatuses()]);
      return buildTradeList(stickers, statuses);
    }
  });
  return { ...query, list: query.data ?? null };
}
