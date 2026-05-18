export type StickerType = "player" | "team_badge" | "team_photo" | "stadium" | "icon" | "special";

export interface Sticker {
  code: string;
  number: number;
  name: string;
  team: string | null;
  section: string;
  type: StickerType;
  imageUrl?: string | null;   // foto del jugador/escudo; null si todavía no la tenemos
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
  team: string | null;
  count: number;     // 0 si falta, >1 si es repetida
}

export interface TradeList {
  needed: TradeListEntry[];     // count = 0 — me faltan
  duplicates: TradeListEntry[]; // count > 1 — tengo repetidas (extras = count - 1)
}


export type FriendshipStatus = "pending" | "accepted" | "blocked" | "rejected";
export type FriendshipSource = "qr_code" | "username_search" | "nearby_match" | "trade_combo";

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
  // Lado: ellos tienen, vos necesitás (lo que buscás)
  theyHaveYouNeed: string[];
  // Lado: vos tenés repe, ellos necesitan (lo que ofreces)
  youHaveTheyNeed: string[];
  // Compat: matchCount = theyHaveYouNeed.length, sample = primeros 3
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
  source: FriendshipSource;
  createdAt: number;
}

export interface OutgoingRequest {
  recipientId: string;
  username: string;
  displayName: string | null;
  cityLabel: string | null;
  status: "pending" | "rejected"; // accepted ones aparecen en Matches, no acá
  message: string | null;
  source: FriendshipSource;
  createdAt: number;
}

// ────────────────────────────────────────────────────────────
// Trades
// ────────────────────────────────────────────────────────────

export type TradeStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed";

export interface Trade {
  id: string;
  proposerId: string;
  recipientId: string;
  proposerGives: string[];   // sticker codes
  proposerGets: string[];    // sticker codes
  status: TradeStatus;
  proposerConfirmedAt: number | null;
  recipientConfirmedAt: number | null;
  message: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export type TradeRole = "proposer" | "recipient";

export type TradeEvent =
  | "accept"
  | "decline"
  | "cancel"
  | "confirm"
  | "unconfirm";

export interface TradeProposalDraft {
  recipientId: string;
  proposerGives: string[];
  proposerGets: string[];
  message: string;
  isValid: boolean;
  invalidReason: "no_gives" | "no_gets" | null;
}

// CTA contextual a mostrar para un trade en una pantalla
export type TradeCtaKind =
  | "none"             // no se muestra
  | "waiting"          // proposer espera al recipient
  | "respond"          // recipient debe Aceptar/Rechazar
  | "mark_done"        // ambos: marcar como hecho
  | "awaiting_other"   // ya marqué; espero al otro
  | "confirm"          // el otro marcó; tengo que confirmar
  | "completed";       // banner verde 24h

export interface TradeCta {
  kind: TradeCtaKind;
  label: string;
  primaryAction?: TradeEvent;
  secondaryAction?: TradeEvent;
}
