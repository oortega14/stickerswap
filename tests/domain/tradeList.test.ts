import { buildTradeList, formatTradeListAsText } from "@/domain/tradeList";
import type { Sticker, StickerStatus } from "@/domain/types";

const stickers: Sticker[] = [
  { code: "ARG-1", number: 100, name: "Crest", team: "ARG", section: "Argentina", type: "team_badge" },
  { code: "ARG-2", number: 101, name: "Messi", team: "ARG", section: "Argentina", type: "player" },
  { code: "ARG-3", number: 102, name: "De Paul", team: "ARG", section: "Argentina", type: "player" },
  { code: "BRA-1", number: 110, name: "Crest", team: "BRA", section: "Brasil", type: "team_badge" },
  { code: "STAD-1", number: 5, name: "Azteca", team: null, section: "Estadios", type: "stadium" }
];

describe("buildTradeList", () => {
  it("returns empty arrays when nothing collected", () => {
    const r = buildTradeList(stickers, []);
    expect(r.needed).toHaveLength(5);
    expect(r.duplicates).toHaveLength(0);
  });

  it("classifies as duplicates when count > 1 and propagates team", () => {
    const statuses: StickerStatus[] = [
      { stickerCode: "ARG-1", count: 2, updatedAt: 1 },
      { stickerCode: "ARG-2", count: 1, updatedAt: 1 }
    ];
    const r = buildTradeList(stickers, statuses);
    expect(r.needed.map((e) => e.code).sort()).toEqual(["ARG-3", "BRA-1", "STAD-1"]);
    expect(r.duplicates.map((e) => e.code)).toEqual(["ARG-1"]);
    expect(r.duplicates[0].count).toBe(2);
    expect(r.duplicates[0].team).toBe("ARG");
    const stad = r.needed.find((e) => e.code === "STAD-1")!;
    expect(stad.team).toBeNull();
  });

  it("sorts needed and duplicates by number ascending", () => {
    const r = buildTradeList(stickers, []);
    const numbers = r.needed.map((e) => e.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });
});

describe("formatTradeListAsText", () => {
  const list = {
    needed: [
      { code: "ARG-2", number: 101, section: "Argentina", count: 0 },
      { code: "ARG-3", number: 102, section: "Argentina", count: 0 },
      { code: "STAD-1", number: 5, section: "Estadios", count: 0 }
    ],
    duplicates: [
      { code: "ARG-1", number: 100, section: "Argentina", count: 3 }
    ]
  };

  it("groups by section when groupBySection=true", () => {
    const text = formatTradeListAsText(list, { groupBySection: true, username: "oscar" });
    expect(text).toContain("stickerSwap · Mundial 2026 — @oscar");
    expect(text).toContain("NECESITO (3)");
    expect(text).toMatch(/Argentina:.*101.*102/);
    expect(text).toContain("Estadios: 5");
    expect(text).toContain("TENGO REPETIDAS (1)");
    expect(text).toMatch(/Argentina: 100 \(×2\)/);
  });

  it("flat list when groupBySection=false", () => {
    const text = formatTradeListAsText(list, { groupBySection: false, username: "oscar" });
    expect(text).toContain("NECESITO: 5, 101, 102");
    expect(text).toContain("TENGO REPE: 100 (×2)");
  });

  it("hides empty sections cleanly", () => {
    const empty = { needed: [], duplicates: [] };
    const text = formatTradeListAsText(empty, { groupBySection: true, username: "x" });
    expect(text).toContain("@x");
    expect(text).not.toContain("NECESITO");
    expect(text).not.toContain("TENGO REPE");
  });
});
