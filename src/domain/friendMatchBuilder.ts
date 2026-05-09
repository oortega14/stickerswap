import type {
  StickerStatus,
  FriendMatch,
  BidirectionalMatch,
  FriendMatchSummary
} from "./types";

export function buildBidirectional(
  friendId: string,
  myStatuses: StickerStatus[],
  friendStatuses: StickerStatus[]
): BidirectionalMatch {
  const myMap = new Map(myStatuses.map((s) => [s.stickerCode, s.count]));
  const fMap = new Map(friendStatuses.map((s) => [s.stickerCode, s.count]));

  const theyHaveYouNeed: FriendMatch[] = [];
  const youHaveTheyNeed: FriendMatch[] = [];

  for (const [code, fCount] of fMap.entries()) {
    if (fCount > 1 && (myMap.get(code) ?? 0) === 0) {
      theyHaveYouNeed.push({ friendId, stickerCode: code, extras: fCount - 1 });
    }
  }
  for (const [code, myCount] of myMap.entries()) {
    if (myCount > 1 && (fMap.get(code) ?? 0) === 0) {
      youHaveTheyNeed.push({ friendId, stickerCode: code, extras: myCount - 1 });
    }
  }

  return { theyHaveYouNeed, youHaveTheyNeed };
}

export interface BidirectionalMatchPayload {
  theyHaveYouNeed: FriendMatch[];
  youHaveTheyNeed: FriendMatch[];
}

export function summarizeMatches(
  matches: BidirectionalMatchPayload,
  friends: Map<string, { username: string; displayName: string | null }>
): FriendMatchSummary[] {
  const codes = new Map<string, { they: string[]; you: string[] }>();
  for (const m of matches.theyHaveYouNeed) {
    const e = codes.get(m.friendId) ?? { they: [], you: [] };
    e.they.push(m.stickerCode);
    codes.set(m.friendId, e);
  }
  for (const m of matches.youHaveTheyNeed) {
    const e = codes.get(m.friendId) ?? { they: [], you: [] };
    e.you.push(m.stickerCode);
    codes.set(m.friendId, e);
  }

  const out: FriendMatchSummary[] = [];
  for (const [friendId, { they, you }] of codes) {
    const meta = friends.get(friendId);
    if (!meta) continue;
    out.push({
      friendId,
      username: meta.username,
      displayName: meta.displayName,
      theyHaveYouNeed: they,
      youHaveTheyNeed: you,
      matchCount: they.length,
      sample: they.slice(0, 3)
    });
  }
  out.sort((a, b) => b.matchCount - a.matchCount);
  return out;
}
