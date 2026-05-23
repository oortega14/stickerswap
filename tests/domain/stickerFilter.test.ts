import { filterStickers, countByFilter } from "@/domain/stickerFilter";
import type { StickerWithStatus } from "@/domain/types";

const mk = (code: string, count: number): StickerWithStatus => ({
  code,
  number: 1,
  team: null,
  section: "X",
  type: "player",
  count
});

describe("filterStickers", () => {
  const stickers = [mk("A", 0), mk("B", 1), mk("C", 2), mk("D", 0), mk("E", 3)];

  it("modo 'all' devuelve todo", () => {
    expect(filterStickers(stickers, "all")).toEqual(stickers);
  });

  it("modo 'missing' devuelve solo count === 0", () => {
    expect(filterStickers(stickers, "missing").map((s) => s.code)).toEqual(["A", "D"]);
  });

  it("modo 'dup' devuelve solo count > 1", () => {
    expect(filterStickers(stickers, "dup").map((s) => s.code)).toEqual(["C", "E"]);
  });
});

describe("countByFilter", () => {
  it("retorna conteos por cada modo", () => {
    const stickers = [mk("A", 0), mk("B", 1), mk("C", 2), mk("D", 0), mk("E", 3)];
    expect(countByFilter(stickers)).toEqual({ all: 5, missing: 2, dup: 2 });
  });
});
