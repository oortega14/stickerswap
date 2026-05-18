import type {
  StickerWithStatus,
  Friend,
  FriendMatchSummary
} from "./types";

export interface DashboardStats {
  collected: number;
  missing: number;
  duplicates: number;
  pct: number;

  teamsComplete: number;
  teamsOneAway: number;
  teamsZero: number;

  badgesCollected: number;
  badgesTotal: number;
  legendsCollected: number;
  legendsTotal: number;
  cokeCollected: number;
  cokeTotal: number;

  friendsCount: number;
  matchesCount: number;

  lastAdded: {
    stickerCode: string;
    stickerName: string;
    updatedAt: number;
  } | null;
}

interface StickerWithUpdatedAt extends StickerWithStatus {
  updatedAt?: number;
}

const TEAMS_TOTAL = 48;
const LEGENDS_TOTAL = 11;
const COKE_TOTAL = 14;

export function computeStats(
  stickers: StickerWithUpdatedAt[],
  friends: Friend[],
  matches: FriendMatchSummary[]
): DashboardStats {
  let collected = 0;
  let duplicates = 0;
  let badgesCollected = 0;
  let legendsCollected = 0;
  let cokeCollected = 0;

  const sectionAgg = new Map<
    string,
    { teamCode: string | null; total: number; collected: number }
  >();

  let lastAdded: DashboardStats["lastAdded"] = null;

  for (const s of stickers) {
    const count = s.count ?? 0;
    if (count >= 1) collected += 1;
    if (count > 1) duplicates += count - 1;
    if (s.type === "team_badge" && count >= 1) badgesCollected += 1;
    if (s.section === "Extras" && count >= 1) legendsCollected += 1;
    if (s.section === "Coca-Cola" && count >= 1) cokeCollected += 1;

    if (count >= 1 && typeof s.updatedAt === "number") {
      if (!lastAdded || s.updatedAt > lastAdded.updatedAt) {
        lastAdded = {
          stickerCode: s.code,
          stickerName: s.name,
          updatedAt: s.updatedAt
        };
      }
    }

    const entry = sectionAgg.get(s.section);
    if (entry) {
      entry.total += 1;
      if (count >= 1) entry.collected += 1;
      if (entry.teamCode !== null && s.team === null) entry.teamCode = null;
    } else {
      sectionAgg.set(s.section, {
        teamCode: s.team ?? null,
        total: 1,
        collected: count >= 1 ? 1 : 0
      });
    }
  }

  let teamsComplete = 0;
  let teamsOneAway = 0;
  let teamsZero = 0;
  for (const [, v] of sectionAgg) {
    if (v.teamCode === null) continue;
    if (v.collected === v.total) teamsComplete += 1;
    if (v.total - v.collected === 1 && v.collected > 0) teamsOneAway += 1;
    if (v.collected === 0) teamsZero += 1;
  }

  const total = stickers.length;
  const missing = total - collected;
  const pct = total === 0 ? 0 : collected / total;

  const friendsCount = friends.filter((f) => f.status === "accepted").length;
  const matchesCount = matches.filter(
    (m) => m.theyHaveYouNeed.length > 0 || m.youHaveTheyNeed.length > 0
  ).length;

  return {
    collected,
    missing,
    duplicates,
    pct,
    teamsComplete,
    teamsOneAway,
    teamsZero,
    badgesCollected,
    badgesTotal: TEAMS_TOTAL,
    legendsCollected,
    legendsTotal: LEGENDS_TOTAL,
    cokeCollected,
    cokeTotal: COKE_TOTAL,
    friendsCount,
    matchesCount,
    lastAdded
  };
}
