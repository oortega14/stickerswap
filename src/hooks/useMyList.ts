import { useQuery } from "@tanstack/react-query";
import { getAllStickers } from "@/data/stickers";
import { listStatuses } from "@/data/stickerStatus";
import { buildTradeList, formatTradeListAsText } from "@/domain/tradeList";
import { useSession } from "@/auth/useSession";
import { useTradePrefs } from "@/store/tradePreferences";

export function useMyList() {
  const session = useSession();
  const { groupBySection } = useTradePrefs();
  const username = session.user?.username ?? "yo";

  const query = useQuery({
    queryKey: ["myList"],
    queryFn: async () => {
      const [stickers, statuses] = await Promise.all([getAllStickers(), listStatuses()]);
      return buildTradeList(stickers, statuses);
    }
  });

  const text = query.data
    ? formatTradeListAsText(query.data, { groupBySection, username })
    : "";

  return { ...query, text };
}
