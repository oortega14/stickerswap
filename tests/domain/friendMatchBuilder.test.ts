import { buildBidirectional, summarizeMatches } from "@/domain/friendMatchBuilder";
import type { StickerStatus } from "@/domain/types";

describe("buildBidirectional", () => {
  it("returns mutual matches", () => {
    const me: StickerStatus[] = [
      { stickerCode: "A1", count: 0, updatedAt: 1 },
      { stickerCode: "A2", count: 3, updatedAt: 1 },
      { stickerCode: "A3", count: 2, updatedAt: 1 }
    ];
    const friend: StickerStatus[] = [
      { stickerCode: "A1", count: 2, updatedAt: 1 },
      { stickerCode: "A2", count: 0, updatedAt: 1 },
      { stickerCode: "A3", count: 1, updatedAt: 1 }
    ];
    const r = buildBidirectional("f1", me, friend);
    expect(r.theyHaveYouNeed.map((m) => m.stickerCode)).toEqual(["A1"]);
    expect(r.theyHaveYouNeed[0].extras).toBe(1);
    expect(r.youHaveTheyNeed.map((m) => m.stickerCode)).toEqual(["A2"]);
    expect(r.youHaveTheyNeed[0].extras).toBe(2);
  });
});

describe("summarizeMatches", () => {
  it("groups by friend and takes first 3 codes", () => {
    const matches = [
      { friendId: "f1", stickerCode: "A1", extras: 1 },
      { friendId: "f1", stickerCode: "A2", extras: 2 },
      { friendId: "f1", stickerCode: "A3", extras: 1 },
      { friendId: "f1", stickerCode: "A4", extras: 1 },
      { friendId: "f2", stickerCode: "A5", extras: 1 }
    ];
    const friends = new Map([
      ["f1", { username: "juli", displayName: "Juli" }],
      ["f2", { username: "maria", displayName: null }]
    ]);
    const r = summarizeMatches(matches, friends);
    expect(r).toHaveLength(2);
    expect(r[0].friendId).toBe("f1");
    expect(r[0].matchCount).toBe(4);
    expect(r[0].sample).toEqual(["A1", "A2", "A3"]);
  });
});
