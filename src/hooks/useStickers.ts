import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  getStickerByCode,
  getStickersByTeam,
  getStickersBySection,
  getStickersWithStatus
} from "@/data/stickers";
import { incrementStatus, decrementStatus, bulkSetOwnedForTeam } from "@/data/stickerStatus";
import { buildAlbumOrder, type AlbumSection } from "@/domain/albumOrder";
import type { StickerWithStatus } from "@/domain/types";

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

export function useSectionStickers(sectionName: string) {
  return useQuery({
    queryKey: ["stickers", "section", sectionName],
    queryFn: () => getStickersBySection(sectionName),
    enabled: !!sectionName
  });
}

/**
 * Carga todos los stickers + counts y los devuelve agrupados por sección
 * en orden de álbum (Intro → equipos A-L → Extras → Estrellas). Usado por
 * la vista /album/[id] para el scroll continuo.
 */
export function useAlbumStickers() {
  return useQuery<AlbumSection<StickerWithStatus>[]>({
    queryKey: ["stickers", "album"],
    queryFn: async () => {
      const stickers = await getStickersWithStatus({ mode: "all" });
      return buildAlbumOrder(stickers);
    }
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
