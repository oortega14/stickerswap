export type StickerType = "player" | "team_badge" | "stadium" | "icon" | "special";

export interface Sticker {
  code: string;
  number: number;
  name: string;
  team: string | null;
  section: string;
  type: StickerType;
}

export interface StickerStatus {
  stickerCode: string;
  count: number;
  updatedAt: number;
}

export interface StickerWithStatus extends Sticker {
  count: number;
}

export interface SectionProgress {
  section: string;
  total: number;
  collected: number;
  pct: number;
}

export interface OverallProgress {
  total: number;
  collected: number;
  pct: number;
  duplicates: number;
  bySection: SectionProgress[];
}
