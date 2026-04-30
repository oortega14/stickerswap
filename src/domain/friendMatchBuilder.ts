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

export function summarizeMatches(
  matches: FriendMatch[],
  friends: Map<string, { username: string; displayName: string | null }>
): FriendMatchSummary[] {
  const grouped = new Map<string, FriendMatch[]>();
  for (const m of matches) {
    const arr = grouped.get(m.friendId) ?? [];
    arr.push(m);
    grouped.set(m.friendId, arr);
  }

  const out: FriendMatchSummary[] = [];
  for (const [friendId, ms] of grouped) {
    const meta = friends.get(friendId);
    if (!meta) continue;
    out.push({
      friendId,
      username: meta.username,
      displayName: meta.displayName,
      matchCount: ms.length,
      sample: ms.slice(0, 3).map((m) => m.stickerCode)
    });
  }
  out.sort((a, b) => b.matchCount - a.matchCount);
  return out;
}
