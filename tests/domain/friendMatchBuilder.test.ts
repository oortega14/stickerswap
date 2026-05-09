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
  it("groups bidirectional matches by friend", () => {
    const matches = {
      theyHaveYouNeed: [
        { friendId: "f1", stickerCode: "A1", extras: 1 },
        { friendId: "f1", stickerCode: "A2", extras: 2 },
        { friendId: "f1", stickerCode: "A3", extras: 1 },
        { friendId: "f1", stickerCode: "A4", extras: 1 },
        { friendId: "f2", stickerCode: "A5", extras: 1 }
      ],
      youHaveTheyNeed: [
        { friendId: "f1", stickerCode: "B1", extras: 1 },
        { friendId: "f1", stickerCode: "B2", extras: 3 },
        { friendId: "f2", stickerCode: "B3", extras: 1 }
      ]
    };
    const friends = new Map([
      ["f1", { username: "juli", displayName: "Juli" }],
      ["f2", { username: "maria", displayName: null }]
    ]);
    const r = summarizeMatches(matches, friends);
    expect(r).toHaveLength(2);

    const f1 = r.find((s) => s.friendId === "f1")!;
    expect(f1.matchCount).toBe(4);
    expect(f1.sample).toEqual(["A1", "A2", "A3"]);
    expect(f1.theyHaveYouNeed).toEqual(["A1", "A2", "A3", "A4"]);
    expect(f1.youHaveTheyNeed).toEqual(["B1", "B2"]);

    const f2 = r.find((s) => s.friendId === "f2")!;
    expect(f2.matchCount).toBe(1);
    expect(f2.theyHaveYouNeed).toEqual(["A5"]);
    expect(f2.youHaveTheyNeed).toEqual(["B3"]);
  });

  it("includes friends that only appear on the youHaveTheyNeed side", () => {
    const matches = {
      theyHaveYouNeed: [],
      youHaveTheyNeed: [{ friendId: "f1", stickerCode: "B1", extras: 1 }]
    };
    const friends = new Map([["f1", { username: "juli", displayName: null }]]);
    const r = summarizeMatches(matches, friends);
    expect(r).toHaveLength(1);
    expect(r[0].matchCount).toBe(0);
    expect(r[0].theyHaveYouNeed).toEqual([]);
    expect(r[0].youHaveTheyNeed).toEqual(["B1"]);
  });
});
