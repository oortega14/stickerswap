import { computeProgress } from "@/domain/progress";
import type { Sticker } from "@/domain/types";

const stickers: Sticker[] = [
  { code: "A1", number: 1, team: "ARG", section: "Argentina", type: "player" },
  { code: "A2", number: 2, team: "ARG", section: "Argentina", type: "player" },
  { code: "B1", number: 3, team: "FRA", section: "Francia", type: "player" }
];

describe("computeProgress", () => {
  it("returns 0% when nothing collected", () => {
    const r = computeProgress(stickers, []);
    expect(r.total).toBe(3);
    expect(r.collected).toBe(0);
    expect(r.pct).toBe(0);
    expect(r.duplicates).toBe(0);
  });

  it("counts collected stickers (count >= 1) and duplicates (count > 1)", () => {
    const r = computeProgress(stickers, [
      { stickerCode: "A1", count: 1, updatedAt: 1 },
      { stickerCode: "A2", count: 3, updatedAt: 1 }
    ]);
    expect(r.collected).toBe(2);
    expect(r.duplicates).toBe(2); // (3-1) extra de A2
    expect(r.pct).toBeCloseTo(2 / 3);
  });

  it("breaks down by section", () => {
    const r = computeProgress(stickers, [
      { stickerCode: "A1", count: 1, updatedAt: 1 }
    ]);
    const argentina = r.bySection.find((s) => s.section === "Argentina");
    const francia = r.bySection.find((s) => s.section === "Francia");
    expect(argentina).toEqual({
      section: "Argentina",
      total: 2,
      collected: 1,
      pct: 0.5,
      teamCode: "ARG"
    });
    expect(francia).toEqual({
      section: "Francia",
      total: 1,
      collected: 0,
      pct: 0,
      teamCode: "FRA"
    });
  });

  it("orders bySection by album position (min sticker number), not alphabetically", () => {
    // Argentina abre con number 1, Brasil con number 50, Alemania con number 100.
    // Alfabético sería Alemania, Argentina, Brasil. Álbum: Argentina, Brasil, Alemania.
    const albumStickers: Sticker[] = [
      { code: "A1", number: 1,   team: "ARG", section: "Argentina", type: "player" },
      { code: "A2", number: 2,   team: "ARG", section: "Argentina", type: "player" },
      { code: "B1", number: 50,  team: "BRA", section: "Brasil",    type: "player" },
      { code: "G1", number: 100, team: "GER", section: "Alemania",  type: "player" }
    ];
    const r = computeProgress(albumStickers, []);
    expect(r.bySection.map((s) => s.section)).toEqual([
      "Argentina",
      "Brasil",
      "Alemania"
    ]);
  });
});
