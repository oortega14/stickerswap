import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getStickersWithStatus, getStickerByCode } from "@/data/stickers";
import { incrementStatus, decrementStatus } from "@/data/stickerStatus";
import type { FilterMode } from "@/store/filters";

const KEY = {
  list: (q: string, m: FilterMode) => ["stickers", "list", q, m] as const,
  detail: (code: string) => ["stickers", "detail", code] as const,
  progress: () => ["stickers", "progress"] as const
};

export function useStickerList(query: string, mode: FilterMode) {
  return useQuery({
    queryKey: KEY.list(query, mode),
    queryFn: () => getStickersWithStatus({ q: query, mode })
  });
}

export function useStickerDetail(code: string) {
  return useQuery({
    queryKey: KEY.detail(code),
    queryFn: () => getStickerByCode(code),
    enabled: !!code
  });
}

export function useIncrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => incrementStatus(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickers"] });
    }
  });
}

export function useDecrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => decrementStatus(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickers"] });
    }
  });
}
