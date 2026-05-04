export type StickerType = "player" | "team_badge" | "team_photo" | "stadium" | "icon" | "special";

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
  teamCode: string | null;  // null para Intro/Extras/Coca-Cola, código FIFA para equipos
}

export interface OverallProgress {
  total: number;
  collected: number;
  pct: number;
  duplicates: number;
  bySection: SectionProgress[];
}

export interface TradeListEntry {
  code: string;
  number: number;
  section: string;
  count: number;     // 0 si falta, >1 si es repetida
}

export interface TradeList {
  needed: TradeListEntry[];     // count = 0 — me faltan
  duplicates: TradeListEntry[]; // count > 1 — tengo repetidas (extras = count - 1)
}

export interface TradeFormatOptions {
  groupBySection: boolean;
  username: string;
}

export type FriendshipStatus = "pending" | "accepted" | "blocked";
export type FriendshipSource = "qr_code" | "username_search" | "nearby_match";

export interface Friend {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: FriendshipStatus;
  source: FriendshipSource;
  createdAt: number;
}

export interface FriendMatch {
  friendId: string;
  stickerCode: string;
  extras: number;
}

export interface FriendMatchSummary {
  friendId: string;
  username: string;
  displayName: string | null;
  matchCount: number;
  sample: string[];
}

export interface BidirectionalMatch {
  theyHaveYouNeed: FriendMatch[];
  youHaveTheyNeed: FriendMatch[];
}

export interface NearbyMatchRaw {
  themId: string;
  username: string;
  displayName: string | null;
  cityLabel: string;
  theyHaveINeed: number;
  iHaveTheyNeed: number;
}

export interface NearbyMatch extends NearbyMatchRaw {
  score: number; // min(theyHaveINeed, iHaveTheyNeed)
}

export interface PendingRequest {
  requesterId: string;
  username: string;
  displayName: string | null;
  cityLabel: string | null;
  message: string | null;
  source: "qr_code" | "username_search" | "nearby_match";
  createdAt: number;
}
