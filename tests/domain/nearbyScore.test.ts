import { rankNearbyMatches } from "@/domain/nearbyScore";
import type { NearbyMatchRaw } from "@/domain/types";

const raw = (themId: string, theyHaveINeed: number, iHaveTheyNeed: number, username = themId): NearbyMatchRaw => ({
  themId,
  username,
  displayName: null,
  cityLabel: "Armenia",
  theyHaveINeed,
  iHaveTheyNeed
});

describe("rankNearbyMatches", () => {
  it("computes score = min(theyHaveINeed, iHaveTheyNeed)", () => {
    const r = rankNearbyMatches([raw("a", 10, 3)]);
    expect(r[0].score).toBe(3);
  });

  it("sorts by score desc", () => {
    const r = rankNearbyMatches([
      raw("a", 5, 5),
      raw("b", 10, 10),
      raw("c", 2, 2)
    ]);
    expect(r.map((m) => m.themId)).toEqual(["b", "a", "c"]);
  });

  it("filters out score < 1", () => {
    const r = rankNearbyMatches([
      raw("a", 0, 5),
      raw("b", 5, 0),
      raw("c", 1, 1),
      raw("d", 0, 0)
    ]);
    expect(r.map((m) => m.themId)).toEqual(["c"]);
  });

  it("ties break alphabetically by username (stable)", () => {
    const r = rankNearbyMatches([
      raw("a", 5, 5, "zoe"),
      raw("b", 5, 5, "ana"),
      raw("c", 5, 5, "marco")
    ]);
    expect(r.map((m) => m.username)).toEqual(["ana", "marco", "zoe"]);
  });

  it("returns empty array for empty input", () => {
    expect(rankNearbyMatches([])).toEqual([]);
  });
});
