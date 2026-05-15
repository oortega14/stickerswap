import { useQuery } from "@tanstack/react-query";
import { getAllStickers } from "@/data/stickers";
import { listStatuses } from "@/data/stickerStatus";
import { buildTradeList, formatTradeListByTeam } from "@/domain/tradeList";
import { useSession } from "@/auth/useSession";

export function useShareList() {
  const session = useSession();
  const query = useQuery({
    queryKey: ["shareList"],
    queryFn: async () => {
      const [stickers, statuses] = await Promise.all([getAllStickers(), listStatuses()]);
      return buildTradeList(stickers, statuses);
    }
  });
  const text = query.data
    ? formatTradeListByTeam(query.data, { username: session.user?.username ?? null })
    : "";
  return { ...query, text };
}
