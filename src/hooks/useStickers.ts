import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getStickerByCode, getStickersByTeam } from "@/data/stickers";
import { incrementStatus, decrementStatus, bulkSetOwnedForTeam } from "@/data/stickerStatus";

const KEY = {
  detail: (code: string) => ["stickers", "detail", code] as const,
  progress: () => ["stickers", "progress"] as const
};

export function useStickerDetail(code: string) {
  return useQuery({
    queryKey: KEY.detail(code),
    queryFn: () => getStickerByCode(code),
    enabled: !!code
  });
}

export function useTeamStickers(teamCode: string) {
  return useQuery({
    queryKey: ["stickers", "team", teamCode],
    queryFn: () => getStickersByTeam(teamCode),
    enabled: !!teamCode
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

export function useBulkMarkTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamCode: string) => bulkSetOwnedForTeam(teamCode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickers"] });
    }
  });
}
